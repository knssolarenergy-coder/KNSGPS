import { Feather } from "@expo/vector-icons";
import {
  useGetMapsToken,
  useGetTechnicianLiveLocations,
  useGetTechnicianTrail,
} from "@workspace/api-client-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";

const TECH_COLORS = [
  "#3B82F6", "#10B981", "#8B5CF6", "#F59E0B",
  "#EF4444", "#06B6D4", "#EC4899", "#84CC16",
];

function formatTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", hour12: true }); }
  catch { return iso; }
}

function minutesAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff === 1) return "1 min ago";
  if (diff < 60) return `${diff} min ago`;
  return `${Math.floor(diff / 60)}h ${diff % 60}m ago`;
}

// ── Mapbox GL JS map HTML (runs inside a sandboxed iframe on web) ─────────────
// Built once (after the access token is fetched) and never rebuilt — the parent
// pushes data via postMessage so the user's manual zoom / pan is never reset on
// a refresh tick. Markers are DOM elements (survive a style switch); the trail
// is a GeoJSON layer re-applied after every satellite/street style change.
// The Mapbox access token is fetched at runtime from an admin-only API endpoint
// (server-side MAPBOX_TOKEN) — never hardcoded in source.
function buildMapHtml(mapboxToken: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <link href="https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css" rel="stylesheet"/>
  <script src="https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js"></script>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    html,body,#map{width:100%;height:100%;background:#e2e8f0;}
    .pin-col{position:relative;width:28px;height:28px;cursor:pointer;}
    .pin-dot{width:28px;height:28px;border-radius:14px;box-shadow:0 3px 6px rgba(0,0,0,0.35);}
    .pin-name{position:absolute;top:32px;left:50%;transform:translateX(-50%);max-width:120px;padding:2px 8px;border-radius:11px;border-width:1.5px;border-style:solid;font-weight:800;font-size:11px;font-family:sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .mapboxgl-ctrl-group{border-radius:10px!important;box-shadow:0 2px 12px rgba(0,0,0,0.15)!important;}
  </style>
</head>
<body>
<div id="map"></div>
<script>
(function(){
  function fail(msg){
    var el=document.getElementById('map');
    if(el){el.style.background='#f1f5f9';el.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;padding:24px;text-align:center;font-family:sans-serif;color:#475569;font-size:13px;line-height:1.5;">'+msg+'</div>';}
  }
  // Mapbox GL needs WebGL; older browsers / GPU-less environments can't run it.
  if(mapboxgl.supported && !mapboxgl.supported()){
    fail('This map requires WebGL, which is unavailable in this browser.');
    return;
  }
  mapboxgl.accessToken='${mapboxToken}';
  var lightStyle='mapbox://styles/mapbox/light-v11';
  var satStyle='mapbox://styles/mapbox/satellite-streets-v12';
  var isSat=false;

  var map;
  try{
    map=new mapboxgl.Map({
      container:'map',
      style:lightStyle,
      center:[69.3451,30.3753],
      zoom:5,
      attributionControl:false
    });
  }catch(err){
    fail('This map requires WebGL, which is unavailable in this browser.');
    return;
  }

  var markerMap={};
  var lastData=[];
  var selectedId=null;
  var hasFitted=false;
  var currentTrail=null;
  var startMarker=null, endMarker=null;

  function post(o){ try{ window.parent.postMessage(o,'*'); }catch(e){} }
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}

  function elHtml(d,sel){
    var scale=sel?1.18:1;
    var border=sel?'border:3px solid #fff;':'border:2px solid #fff;';
    return '<div class="pin-dot" style="background:'+d.color+';'+border+'transform:scale('+scale+');"></div>'
      +'<div class="pin-name" style="border-color:'+d.color+';background:'+(sel?d.color:'#fff')+';color:'+(sel?'#fff':d.color)+';">'+esc(d.name)+'</div>';
  }
  function makeEl(d,sel){
    var el=document.createElement('div');
    el.className='pin-col';
    el.innerHTML=elHtml(d,sel);
    return el;
  }

  function setMarkers(data){
    lastData=data;
    var seen={}; var coords=[];
    data.forEach(function(d){
      if(isNaN(d.lat)||isNaN(d.lng))return;
      seen[d.id]=true; coords.push([d.lng,d.lat]);
      var sel=d.id===selectedId;
      if(markerMap[d.id]){
        markerMap[d.id].setLngLat([d.lng,d.lat]);
        markerMap[d.id].getElement().innerHTML=elHtml(d,sel);
      } else {
        var el=makeEl(d,sel);
        var m=new mapboxgl.Marker({element:el,anchor:'center'}).setLngLat([d.lng,d.lat]).addTo(map);
        (function(id){ el.addEventListener('click',function(){ post({type:'selectTech',techId:id}); }); })(d.id);
        markerMap[d.id]=m;
      }
    });
    Object.keys(markerMap).forEach(function(id){
      if(!seen[id]){ markerMap[id].remove(); delete markerMap[id]; }
    });
    return coords;
  }

  function refreshSelection(){
    lastData.forEach(function(d){
      var m=markerMap[d.id];
      if(m){ m.getElement().innerHTML=elHtml(d,d.id===selectedId); }
    });
  }

  function fitTo(coords){
    if(coords.length===1){ map.flyTo({center:coords[0],zoom:14}); }
    else {
      var b=coords.reduce(function(bb,c){return bb.extend(c);},new mapboxgl.LngLatBounds(coords[0],coords[0]));
      map.fitBounds(b,{padding:60,maxZoom:14});
    }
  }

  function removeTrailLayer(){
    if(map.getLayer('trail-line'))map.removeLayer('trail-line');
    if(map.getSource('trail'))map.removeSource('trail');
  }
  function applyTrail(){
    // addSource/addLayer throw if the (new) style isn't loaded yet — e.g. a
    // trail refresh arriving mid satellite/street switch. Defer until ready.
    if(!map.isStyleLoaded()){ map.once('style.load',applyTrail); return; }
    removeTrailLayer();
    if(!currentTrail)return;
    map.addSource('trail',{type:'geojson',data:{type:'Feature',geometry:{type:'LineString',coordinates:currentTrail.coords}}});
    map.addLayer({id:'trail-line',type:'line',source:'trail',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':currentTrail.color,'line-width':4,'line-opacity':0.9}});
  }
  function dot(color){var e=document.createElement('div');e.style.cssText='width:13px;height:13px;border-radius:7px;background:'+color+';border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.4);';return e;}
  function clearTrailEnds(){if(startMarker){startMarker.remove();startMarker=null;}if(endMarker){endMarker.remove();endMarker=null;}}
  function setTrailEnds(coords){
    clearTrailEnds();
    startMarker=new mapboxgl.Marker({element:dot('#94A3B8')}).setLngLat(coords[0]).addTo(map);
    endMarker=new mapboxgl.Marker({element:dot('#10B981')}).setLngLat(coords[coords.length-1]).addTo(map);
  }
  function showTrail(latlngs,color){
    // Parent sends [lat,lng]; Mapbox needs [lng,lat].
    var coords=(latlngs||[]).map(function(c){return [c[1],c[0]];});
    if(coords.length>=2){
      currentTrail={coords:coords,color:color||'#3B82F6'};
      applyTrail();
      setTrailEnds(coords);
      var b=coords.reduce(function(bb,c){return bb.extend(c);},new mapboxgl.LngLatBounds(coords[0],coords[0]));
      map.fitBounds(b,{padding:60,maxZoom:15});
    } else { clearTrail(); }
  }
  function clearTrail(){ currentTrail=null; applyTrail(); clearTrailEnds(); }

  function setSatellite(sat){
    if(sat===isSat)return;
    isSat=sat;
    map.setStyle(sat?satStyle:lightStyle);
    // Sources/layers are wiped on style change; markers (DOM) survive.
    map.once('style.load',function(){ applyTrail(); });
  }

  window.addEventListener('message',function(e){
    var d=e.data; if(!d||!d.type)return;
    if(d.type==='UPDATE_MARKERS'){
      selectedId=d.selectedId||null;
      var coords=setMarkers(d.markers||[]);
      if(!hasFitted&&coords.length){ hasFitted=true; fitTo(coords); }
      refreshSelection();
    } else if(d.type==='SHOW_TRAIL'){ showTrail(d.latlngs,d.color); }
    else if(d.type==='CLEAR_TRAIL'){ clearTrail(); }
    else if(d.type==='SET_SATELLITE'){ setSatellite(!!d.sat); }
    else if(d.type==='FLY_TO'&&d.techId){
      selectedId=d.techId; refreshSelection();
      var m=markerMap[d.techId]; if(m){ map.flyTo({center:m.getLngLat(),zoom:15}); }
    }
  });

  // Tell the parent the map is ready so it can push the first batch of data.
  map.on('load',function(){ post({type:'ready'}); });
})();
</script>
</body>
</html>`;
}

export function LiveMapSection() {
  const colors = useColors();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const mapReadyRef = useRef(false);
  const [selectedTechId, setSelectedTechId] = useState<string | null>(null);
  const [isSat, setIsSat] = useState(false);
  const selectedColorRef = useRef<string>("#3B82F6");
  const locsRef = useRef<Array<{ id: string; lat: number; lng: number; name: string; color: string }>>([]);

  const { data: locations, isRefetching, isLoading } = useGetTechnicianLiveLocations({
    query: { queryKey: ["tech-live-section"], refetchInterval: 30_000 },
  });

  // Rolling last-24h trail for the selected technician — spans attendance
  // sessions so overnight movement stays visible after midnight.
  const { data: trail, isLoading: trailLoading } = useGetTechnicianTrail(
    selectedTechId ?? "",
    { query: { queryKey: ["trail-section", selectedTechId], enabled: !!selectedTechId, refetchInterval: selectedTechId ? 30_000 : false } }
  );

  // Mapbox access token — fetched at runtime (never hardcoded). The map HTML is
  // built only once the token arrives, then the iframe mounts.
  const { data: mapsTokenData } = useGetMapsToken({
    query: { queryKey: ["maps-token"], staleTime: Infinity },
  });
  const mapboxToken = mapsTokenData?.token;
  const mapHtml = useMemo(
    () => (mapboxToken ? buildMapHtml(mapboxToken) : null),
    [mapboxToken],
  );

  const locs = useMemo(() => (
    (locations ?? []).filter(l => !isNaN(parseFloat(l.latitude)) && !isNaN(parseFloat(l.longitude)))
  ), [locations]);

  function buildPayload() {
    return locs.map((loc, idx) => ({
      id: loc.technicianId,
      lat: parseFloat(loc.latitude),
      lng: parseFloat(loc.longitude),
      name: loc.name,
      color: TECH_COLORS[idx % TECH_COLORS.length],
    }));
  }
  locsRef.current = buildPayload();

  function post(msg: Record<string, unknown>) {
    iframeRef.current?.contentWindow?.postMessage(msg, "*");
  }

  function pushMarkers() {
    if (!mapReadyRef.current) return;
    post({ type: "UPDATE_MARKERS", markers: locsRef.current, selectedId: selectedTechId });
  }

  function pushTrail() {
    if (!mapReadyRef.current) return;
    if (!selectedTechId || !trail || trail.length === 0) {
      post({ type: "CLEAR_TRAIL" });
      return;
    }
    const valid = trail.filter(p => !isNaN(parseFloat(p.latitude)) && !isNaN(parseFloat(p.longitude)));
    const latlngs = valid.map(p => [parseFloat(p.latitude), parseFloat(p.longitude)]);
    if (latlngs.length < 2) { post({ type: "CLEAR_TRAIL" }); return; }
    post({ type: "SHOW_TRAIL", latlngs, color: selectedColorRef.current });
  }

  useEffect(() => { pushMarkers(); }, [locations, selectedTechId]);
  useEffect(() => { pushTrail(); }, [trail, selectedTechId]);
  useEffect(() => {
    if (mapReadyRef.current && selectedTechId) post({ type: "FLY_TO", techId: selectedTechId });
  }, [selectedTechId]);

  // Fresh-closure handlers for messages arriving from the iframe (map load /
  // marker clicks). Registered once; the ref is reassigned every render so the
  // handler always sees the latest state.
  const handlersRef = useRef<{ onReady: () => void; onSelect: (id: string) => void }>({
    onReady: () => {},
    onSelect: () => {},
  });
  handlersRef.current.onReady = () => {
    mapReadyRef.current = true;
    pushMarkers();
    pushTrail();
    if (selectedTechId) post({ type: "FLY_TO", techId: selectedTechId });
  };
  handlersRef.current.onSelect = (techId: string) => {
    if (selectedTechId === techId) {
      setSelectedTechId(null);
      selectedColorRef.current = "#3B82F6";
      post({ type: "CLEAR_TRAIL" });
    } else {
      const idx = locs.findIndex(l => l.technicianId === techId);
      selectedColorRef.current = TECH_COLORS[(idx < 0 ? 0 : idx) % TECH_COLORS.length];
      setSelectedTechId(techId);
      post({ type: "CLEAR_TRAIL" });
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    function onMsg(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const d = e.data as { type?: string; techId?: string } | null;
      if (!d || !d.type) return;
      if (d.type === "ready") handlersRef.current.onReady();
      else if (d.type === "selectTech" && typeof d.techId === "string") handlersRef.current.onSelect(d.techId);
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  function handleSatToggle() {
    setIsSat(prev => {
      const next = !prev;
      post({ type: "SET_SATELLITE", sat: next });
      return next;
    });
  }

  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      <View style={[s.mapWrapper, { borderColor: colors.border }]}>
        {mapHtml ? (
          // @ts-ignore — iframe is valid DOM element in Expo web
          <iframe
            ref={iframeRef}
            srcDoc={mapHtml}
            style={{ width: "100%", height: "100%", border: "none", borderRadius: 0, display: "block" }}
            onLoad={() => { /* map posts {type:'ready'} once Mapbox has loaded */ }}
            title="Live Technician Map"
            sandbox="allow-scripts allow-same-origin"
          />
        ) : (
          <View style={[s.mapLoading, { backgroundColor: colors.muted }]}>
            <ActivityIndicator size="large" color="#0891B2" />
          </View>
        )}

        {/* Satellite / street toggle (top-left) */}
        {mapHtml && (
          <TouchableOpacity style={s.satBtn} onPress={handleSatToggle} activeOpacity={0.85}>
            <Text style={s.satBtnText}>{isSat ? "🗺 Street" : "🛰 Satellite"}</Text>
          </TouchableOpacity>
        )}

        <View style={s.liveBadge}>
          <View style={s.liveDot} />
          <Text style={s.liveText}>{isRefetching ? "UPDATING" : "LIVE"}</Text>
        </View>
      </View>

      {isLoading && (
        <View style={s.centered}>
          <ActivityIndicator size="large" color="#0891B2" />
          <Text style={[s.loadingText, { color: colors.mutedForeground }]}>Loading locations…</Text>
        </View>
      )}

      {!isLoading && locs.length === 0 && (
        <View style={[s.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="map" size={32} color={colors.mutedForeground} />
          <Text style={[s.emptyTitle, { color: colors.foreground }]}>No Technicians Tracked</Text>
          <Text style={[s.emptySub, { color: colors.mutedForeground }]}>
            Technicians appear here once they log in and share their location.
          </Text>
        </View>
      )}

      {!isLoading && locs.length > 0 && (
        <View style={s.listContent}>
          <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>
            {locs.length} Technician{locs.length > 1 ? "s" : ""} Tracked · tap to view trail
          </Text>
          {locs.map((loc, idx) => {
            const pinColor = TECH_COLORS[idx % TECH_COLORS.length];
            const lat = parseFloat(loc.latitude);
            const lng = parseFloat(loc.longitude);
            const isSelected = selectedTechId === loc.technicianId;
            const statusColor = loc.status === "checked-in" ? "#10B981" : loc.status === "offline" ? "#94A3B8" : "#F59E0B";
            const statusLabel = loc.status.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
            return (
              <TouchableOpacity
                key={loc.technicianId}
                style={[s.card, { backgroundColor: colors.card, borderColor: isSelected ? pinColor : colors.border }]}
                onPress={() => {
                  if (isSelected) {
                    setSelectedTechId(null);
                    selectedColorRef.current = "#3B82F6";
                    if (mapReadyRef.current) post({ type: "CLEAR_TRAIL" });
                  } else {
                    setSelectedTechId(loc.technicianId);
                    selectedColorRef.current = pinColor;
                    if (mapReadyRef.current) post({ type: "CLEAR_TRAIL" });
                  }
                }}
                activeOpacity={0.85}
              >
                <View style={{ height: 3, backgroundColor: pinColor, borderTopLeftRadius: 14, borderTopRightRadius: 14 }} />
                <View style={s.cardBody}>
                  <View style={[s.avatar, { backgroundColor: pinColor + "22" }]}>
                    <Text style={[s.avatarText, { color: pinColor }]}>
                      {loc.name.trim().charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[s.techName, { color: colors.foreground }]}>{loc.name}</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {loc.checkInAt ? (
                        <View style={[s.chip, { backgroundColor: colors.muted }]}>
                          <Feather name="log-in" size={10} color={colors.mutedForeground} />
                          <Text style={[s.chipText, { color: colors.mutedForeground }]}>In {formatTime(loc.checkInAt)}</Text>
                        </View>
                      ) : null}
                      <View style={[s.chip, { backgroundColor: statusColor + "15" }]}>
                        <Feather name="radio" size={10} color={statusColor} />
                        <Text style={[s.chipText, { color: statusColor }]}>{minutesAgo(loc.recordedAt)}</Text>
                      </View>
                      {!isNaN(lat) && !isNaN(lng) && (
                        <View style={[s.chip, { backgroundColor: colors.muted }]}>
                          <Feather name="crosshair" size={10} color={colors.mutedForeground} />
                          <Text style={[s.chipText, { color: colors.mutedForeground }]}>{lat.toFixed(4)}, {lng.toFixed(4)}</Text>
                        </View>
                      )}
                    </View>
                    {loc.address ? (
                      <Text style={[s.address, { color: colors.mutedForeground }]} numberOfLines={2}>
                        📍 {loc.address}
                      </Text>
                    ) : null}
                  </View>
                  <View style={[s.activeBadge, {
                    backgroundColor: isSelected ? pinColor + "22" : statusColor + "15",
                    borderColor: isSelected ? pinColor + "66" : statusColor + "44",
                  }]}>
                    <View style={[s.activeDot, { backgroundColor: isSelected ? pinColor : statusColor }]} />
                    <Text style={[s.activeBadgeText, { color: isSelected ? pinColor : statusColor }]}>
                      {isSelected ? "Selected" : statusLabel}
                    </Text>
                  </View>
                </View>

                {isSelected && (
                  <View style={{ borderTopWidth: 1, borderTopColor: pinColor + "33", paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <Feather name="map-pin" size={12} color={pinColor} />
                      <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: pinColor, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Location Trail
                      </Text>
                    </View>
                    {trailLoading ? (
                      <ActivityIndicator size="small" color={pinColor} style={{ marginVertical: 8 }} />
                    ) : !trail || trail.length === 0 ? (
                      <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
                        No location pings in last 24h
                      </Text>
                    ) : (
                      trail.map((ping, pingIdx) => {
                        const isLatest = pingIdx === trail.length - 1;
                        const pingTime = new Date(ping.recordedAt).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", hour12: true });
                        const mapsUrl = `https://maps.google.com/?q=${ping.latitude},${ping.longitude}`;
                        return (
                          <View key={ping.id} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: isLatest ? "#10B981" : pinColor, marginTop: 4 }} />
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 1 }}>
                                <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{pingTime}</Text>
                                {isLatest && (
                                  <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, backgroundColor: "#10B98122", borderWidth: 1, borderColor: "#10B98144" }}>
                                    <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: "#10B981" }}>LIVE</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginBottom: 2 }} numberOfLines={2}>
                                {ping.address || `${ping.latitude}, ${ping.longitude}`}
                              </Text>
                              <TouchableOpacity onPress={() => Linking.openURL(mapsUrl)} activeOpacity={0.7}>
                                <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: "#0891B2", textDecorationLine: "underline" }}>Open in Maps</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  mapWrapper: { marginHorizontal: 14, marginTop: 14, borderRadius: 16, overflow: "hidden", height: 340, borderWidth: 1, borderColor: "#0891B222" },
  mapLoading: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  satBtn: {
    position: "absolute",
    top: 10,
    left: 10,
    zIndex: 1000,
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation: 6,
  },
  satBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#1e293b" },
  liveBadge: { position: "absolute", top: 10, right: 10, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(0,0,0,0.72)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, zIndex: 1000 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#EF4444" },
  liveText: { color: "white", fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  centered: { alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 8 },
  emptyCard: { margin: 14, marginTop: 14, borderRadius: 16, borderWidth: 1, alignItems: "center", padding: 32, gap: 10 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_700Bold", textAlign: "center" },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  listContent: { padding: 14, gap: 0 },
  sectionLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", paddingTop: 4, paddingBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  card: { marginBottom: 10, borderRadius: 14, borderWidth: 1.5, overflow: "hidden" },
  cardBody: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14 },
  avatar: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  techName: { fontSize: 15, fontFamily: "Inter_700Bold" },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  chipText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  address: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  activeBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, borderWidth: 1, alignSelf: "flex-start" },
  activeDot: { width: 6, height: 6, borderRadius: 3 },
  activeBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold" },
});
