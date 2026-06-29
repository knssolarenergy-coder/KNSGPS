import { Feather } from "@expo/vector-icons";
import {
  useGetMapsToken,
  useGetTechnicianLiveLocations,
  useGetTechnicianTrail,
} from "@workspace/api-client-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import WebView from "react-native-webview";
import { useColors } from "@/hooks/useColors";

const TECH_COLORS = [
  "#3B82F6", "#10B981", "#8B5CF6", "#F59E0B",
  "#EF4444", "#06B6D4", "#EC4899", "#84CC16",
];

function formatTime(iso: string | null | undefined) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("en-PK", {
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
  } catch { return iso; }
}

function minutesAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff === 1) return "1 min ago";
  if (diff < 60) return `${diff}m ago`;
  return `${Math.floor(diff / 60)}h ${diff % 60}m ago`;
}

// ── Mapbox GL JS map HTML (runs inside a WebView) ────────────────────────────
// Built once (after the access token is fetched) and never rebuilt — RN pushes
// data via injectJavaScript so the user's manual zoom / pan is never reset on a
// refresh tick. Markers are DOM elements (survive a style switch); the trail is
// a GeoJSON layer re-applied after every satellite/street style change.
// The Mapbox access token is fetched at runtime from an admin-only API endpoint
// (server-side MAPBOX_TOKEN) — never hardcoded in source.
const buildMapHtml = (mapboxToken: string) => `<!DOCTYPE html>
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
  mapboxgl.accessToken='${mapboxToken}';
  var lightStyle='mapbox://styles/mapbox/light-v11';
  var satStyle='mapbox://styles/mapbox/satellite-streets-v12';
  var isSat=false;

  var map=new mapboxgl.Map({
    container:'map',
    style:lightStyle,
    center:[69.3451,30.3753],
    zoom:5,
    attributionControl:false
  });

  var markerMap={};
  var lastData=[];
  var selectedId=null;
  var hasFitted=false;
  var currentTrail=null;
  var startMarker=null, endMarker=null;

  function post(o){ if(window.ReactNativeWebView){ window.ReactNativeWebView.postMessage(JSON.stringify(o)); } }
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
      var sel = d.id===selectedId;
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

  window.updateMarkers=function(payload){
    selectedId = (payload && payload.selectedId) || null;
    var coords=setMarkers((payload && payload.markers) || []);
    if(!hasFitted && coords.length){ hasFitted=true; fitTo(coords); }
  };

  window.flyToTech=function(id){
    selectedId=id;
    refreshSelection();
    var m=markerMap[id];
    if(m){ map.flyTo({center:m.getLngLat(),zoom:15}); }
  };

  function removeTrailLayer(){
    if(map.getLayer('trail-line'))map.removeLayer('trail-line');
    if(map.getSource('trail'))map.removeSource('trail');
  }
  function applyTrail(){
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

  window.clearTrail=function(){
    currentTrail=null; applyTrail(); clearTrailEnds();
  };

  window.updateTrail=function(t){
    var raw=(t && t.coords) || [];
    // RN sends [lat,lng]; Mapbox needs [lng,lat].
    var coords=raw.map(function(c){return [c[1],c[0]];});
    var color=(t && t.color) || '#3B82F6';
    if(coords.length>=2){
      currentTrail={coords:coords,color:color};
      applyTrail();
      setTrailEnds(coords);
      var b=coords.reduce(function(bb,c){return bb.extend(c);},new mapboxgl.LngLatBounds(coords[0],coords[0]));
      map.fitBounds(b,{padding:60,maxZoom:15});
    } else if(coords.length===1){
      currentTrail=null; applyTrail(); clearTrailEnds();
      map.flyTo({center:coords[0],zoom:15});
    } else {
      window.clearTrail();
    }
  };

  window.setSatellite=function(sat){
    if(sat===isSat)return;
    isSat=sat;
    map.setStyle(sat?satStyle:lightStyle);
    // Sources/layers are wiped on style change; markers (DOM) survive.
    map.once('style.load',function(){ applyTrail(); });
  };

  // Tell RN the map is ready so it can push the first batch of data.
  map.on('load',function(){ post({type:'ready'}); });
})();
true;
</script>
</body>
</html>`;

export function LiveMapSection() {
  const colors = useColors();
  const webViewRef = useRef<WebView | null>(null);
  const mapReadyRef = useRef(false);

  const [selectedTechId, setSelectedTechId] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState(TECH_COLORS[0]);
  const [showTrail, setShowTrail] = useState(false);
  const [isSat, setIsSat] = useState(false);

  const handleSatToggle = useCallback(() => {
    setIsSat((prev) => {
      const next = !prev;
      webViewRef.current?.injectJavaScript(`window.setSatellite(${next});true;`);
      return next;
    });
  }, []);

  const { data: locations, isRefetching, isLoading } =
    useGetTechnicianLiveLocations({
      query: { queryKey: ["tech-live-native"], refetchInterval: 5_000 },
    });

  // Rolling last-24h trail for the selected technician — spans attendance
  // sessions so overnight movement stays visible after midnight.
  const { data: trail, isLoading: trailLoading } = useGetTechnicianTrail(
    selectedTechId ?? "",
    {
      query: {
        queryKey: ["trail-native", selectedTechId],
        enabled: !!selectedTechId && showTrail,
        refetchInterval: showTrail ? 5_000 : false,
      },
    },
  );

  // Mapbox access token — fetched at runtime (never hardcoded). The map HTML is
  // built only once the token arrives, then the WebView mounts.
  const { data: mapsTokenData } = useGetMapsToken({
    query: { queryKey: ["maps-token"], staleTime: Infinity },
  });
  const mapboxToken = mapsTokenData?.token;
  const mapHtml = useMemo(
    () => (mapboxToken ? buildMapHtml(mapboxToken) : null),
    [mapboxToken],
  );

  const locs = useMemo(
    () =>
      (locations ?? []).filter(
        (l) => !isNaN(parseFloat(l.latitude)) && !isNaN(parseFloat(l.longitude)),
      ),
    [locations],
  );

  // Leaflet expects [lat, lng].
  const trailCoords = useMemo(() => {
    if (!trail || trail.length < 2) return null;
    const coords = trail
      .filter((p) => !isNaN(parseFloat(p.latitude)) && !isNaN(parseFloat(p.longitude)))
      .map((p) => [parseFloat(p.latitude), parseFloat(p.longitude)] as [number, number]);
    if (coords.length < 2) return null;
    return coords;
  }, [trail]);

  const buildMarkers = useCallback(
    () =>
      locs.map((loc, idx) => ({
        id: loc.technicianId,
        lat: parseFloat(loc.latitude),
        lng: parseFloat(loc.longitude),
        name: loc.name,
        color: TECH_COLORS[idx % TECH_COLORS.length],
      })),
    [locs],
  );

  const pushMarkers = useCallback(() => {
    if (!mapReadyRef.current) return;
    const payload = { markers: buildMarkers(), selectedId: selectedTechId };
    webViewRef.current?.injectJavaScript(`window.updateMarkers(${JSON.stringify(payload)});true;`);
  }, [buildMarkers, selectedTechId]);

  const pushTrail = useCallback(() => {
    if (!mapReadyRef.current) return;
    if (selectedTechId && showTrail && trailCoords) {
      const payload = { coords: trailCoords, color: selectedColor };
      webViewRef.current?.injectJavaScript(`window.updateTrail(${JSON.stringify(payload)});true;`);
    } else {
      webViewRef.current?.injectJavaScript(`window.clearTrail();true;`);
    }
  }, [selectedTechId, showTrail, trailCoords, selectedColor]);

  // Push markers whenever data or selection changes.
  useEffect(() => { pushMarkers(); }, [pushMarkers, locations]);

  // Fly to a newly selected technician.
  useEffect(() => {
    if (!mapReadyRef.current || !selectedTechId) return;
    webViewRef.current?.injectJavaScript(`window.flyToTech(${JSON.stringify(selectedTechId)});true;`);
  }, [selectedTechId]);

  // Draw / clear the trail.
  useEffect(() => { pushTrail(); }, [pushTrail, trail]);

  const handleTechSelect = useCallback(
    (techId: string, color: string) => {
      if (selectedTechId === techId) {
        setSelectedTechId(null);
        setShowTrail(false);
      } else {
        setSelectedTechId(techId);
        setSelectedColor(color);
        setShowTrail(true);
      }
    },
    [selectedTechId],
  );

  const onMessage = useCallback(
    (e: { nativeEvent: { data: string } }) => {
      try {
        const msg = JSON.parse(e.nativeEvent.data);
        if (msg.type === "ready") {
          mapReadyRef.current = true;
          pushMarkers();
          pushTrail();
          if (selectedTechId) {
            webViewRef.current?.injectJavaScript(`window.flyToTech(${JSON.stringify(selectedTechId)});true;`);
          }
        } else if (msg.type === "selectTech" && typeof msg.techId === "string") {
          const idx = locs.findIndex((l) => l.technicianId === msg.techId);
          const color = TECH_COLORS[(idx < 0 ? 0 : idx) % TECH_COLORS.length];
          handleTechSelect(msg.techId, color);
        }
      } catch {
        // Ignore malformed messages
      }
    },
    [pushMarkers, pushTrail, selectedTechId, locs, handleTechSelect],
  );

  const selectedLoc = useMemo(
    () => locs.find((l) => l.technicianId === selectedTechId),
    [locs, selectedTechId],
  );

  return (
    <View style={{ flex: 1 }}>
      {mapHtml ? (
        <WebView
          ref={webViewRef}
          source={{ html: mapHtml }}
          style={StyleSheet.absoluteFill}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={["*"]}
          mixedContentMode="always"
          onMessage={onMessage}
        />
      ) : null}

      {/* ── Loading overlay (map token / locations still loading) ── */}
      {(isLoading || !mapHtml) && (
        <View style={s.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#0891B2" />
        </View>
      )}

      {/* ── Satellite / street toggle (native button, top-left) ── */}
      {!isLoading && mapHtml && (
        <TouchableOpacity style={s.satBtn} onPress={handleSatToggle} activeOpacity={0.85}>
          <Text style={s.satBtnText}>{isSat ? "🗺 Street" : "🛰 Satellite"}</Text>
        </TouchableOpacity>
      )}

      {/* ── Top overlays (right cluster, leaves top-left for satellite btn) ── */}
      <View style={s.topOverlay} pointerEvents="none">
        {locs.length > 0 && (
          <View style={s.countBadge}>
            <View style={s.countDot} />
            <Text style={s.countText}>
              {locs.length} Tracked
            </Text>
          </View>
        )}
        <View style={[s.liveBadge, { backgroundColor: isRefetching ? "rgba(14,165,233,0.85)" : "rgba(0,0,0,0.70)" }]}>
          <View style={[s.liveDot, { backgroundColor: isRefetching ? "white" : "#EF4444" }]} />
          <Text style={s.liveText}>{isRefetching ? "UPDATING" : "LIVE"}</Text>
        </View>
      </View>

      {/* ── Empty state ── */}
      {!isLoading && locs.length === 0 && (
        <View style={s.emptyOverlay} pointerEvents="none">
          <View style={s.emptyCard}>
            <Feather name="radio" size={28} color="#64748B" />
            <Text style={s.emptyTitle}>No Technicians Tracked</Text>
            <Text style={s.emptySub}>Technicians appear here once they log in and share location.</Text>
          </View>
        </View>
      )}

      {/* ── Bottom: tech card strip ── */}
      {!selectedTechId && locs.length > 0 && (
        <View style={s.cardStripWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.cardStripContent}
          >
            {locs.map((loc, idx) => {
              const pinColor = TECH_COLORS[idx % TECH_COLORS.length];
              const statusColor = loc.status === "checked-in" ? "#10B981" : loc.status === "offline" ? "#94A3B8" : "#F59E0B";
              const statusLabel = loc.status.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
              return (
                <TouchableOpacity
                  key={loc.technicianId}
                  style={[s.techCard, { borderColor: pinColor }]}
                  onPress={() => handleTechSelect(loc.technicianId, pinColor)}
                  activeOpacity={0.85}
                >
                  <View style={[s.techCardAccent, { backgroundColor: pinColor }]} />
                  <View style={s.techCardBody}>
                    <View style={[s.techAvatar, { backgroundColor: pinColor + "22" }]}>
                      <Text style={[s.techAvatarText, { color: pinColor }]}>
                        {loc.name.trim().charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.techCardName} numberOfLines={1}>{loc.name}</Text>
                      <View style={s.techCardRow}>
                        <View style={[s.statusDot, { backgroundColor: statusColor }]} />
                        <Text style={s.techCardSub}>{minutesAgo(loc.recordedAt)}</Text>
                      </View>
                      <Text style={s.techCardIn}>{loc.checkInAt ? `In ${formatTime(loc.checkInAt)}` : statusLabel}</Text>
                    </View>
                  </View>
                  <Text style={[s.techCardTrailHint, { color: pinColor }]}>Tap for trail →</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ── Bottom: trail panel when tech selected ── */}
      {selectedTechId && selectedLoc && (
        <View style={[s.trailPanel, { backgroundColor: colors.card }]}>
          {/* Header */}
          <View style={[s.trailPanelHeader, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={[s.trailPanelDot, { backgroundColor: selectedColor }]} />
                <Text style={[s.trailPanelName, { color: colors.foreground }]} numberOfLines={1}>
                  {selectedLoc.name}
                </Text>
              </View>
              <Text style={[s.trailPanelSub, { color: colors.mutedForeground }]}>
                {selectedLoc.checkInAt ? `In ${formatTime(selectedLoc.checkInAt)} · ` : ""}{minutesAgo(selectedLoc.recordedAt)}
              </Text>
            </View>
            <TouchableOpacity
              style={[s.closeBtn, { backgroundColor: colors.muted }]}
              onPress={() => { setSelectedTechId(null); setShowTrail(false); }}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Feather name="x" size={14} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {/* Trail list */}
          <ScrollView style={{ maxHeight: 160 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 12, gap: 8 }}>
            {trailLoading ? (
              <ActivityIndicator size="small" color={selectedColor} style={{ marginVertical: 12 }} />
            ) : !trail || trail.length === 0 ? (
              <Text style={[s.trailEmpty, { color: colors.mutedForeground }]}>No location pings in last 24h</Text>
            ) : (
              [...trail].reverse().map((ping, i) => {
                const isLatest = i === 0;
                const t = new Date(ping.recordedAt).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", hour12: true });
                return (
                  <TouchableOpacity
                    key={ping.id}
                    style={s.pingRow}
                    onPress={() => Linking.openURL(`https://maps.google.com/?q=${ping.latitude},${ping.longitude}`)}
                    activeOpacity={0.7}
                  >
                    <View style={[s.pingBullet, { backgroundColor: isLatest ? "#10B981" : selectedColor + "88" }]} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={[s.pingTime, { color: colors.foreground }]}>{t}</Text>
                        {isLatest && (
                          <View style={s.liveChip}>
                            <Text style={s.liveChipText}>LIVE</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[s.pingAddr, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {ping.address || `${ping.latitude}, ${ping.longitude}`}
                      </Text>
                    </View>
                    <Feather name="external-link" size={12} color={colors.mutedForeground} />
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  // Loading
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.6)" },
  // Top overlays (right cluster)
  topOverlay: { position: "absolute", top: Platform.OS === "ios" ? 56 : 12, right: 12, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 8 },
  // Satellite / street toggle button (top-left)
  satBtn: {
    position: "absolute",
    top: Platform.OS === "ios" ? 56 : 12,
    left: 12,
    zIndex: 10,
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
  },
  satBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#1e293b" },
  countBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,0,0,0.70)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  countDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#10B981" },
  countText: { color: "white", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveText: { color: "white", fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  // Empty state
  emptyOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  emptyCard: { backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 20, padding: 28, alignItems: "center", gap: 8, maxWidth: 260 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#0F172A", textAlign: "center" },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#64748B", textAlign: "center" },
  // Card strip
  cardStripWrapper: { position: "absolute", bottom: 0, left: 0, right: 0, paddingBottom: Platform.OS === "ios" ? 28 : 12 },
  cardStripContent: { paddingHorizontal: 12, gap: 10 },
  techCard: { width: 160, backgroundColor: "white", borderRadius: 14, borderWidth: 1.5, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5 },
  techCardAccent: { height: 3 },
  techCardBody: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10 },
  techAvatar: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  techAvatarText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  techCardName: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#0F172A" },
  techCardRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  techCardSub: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#64748B" },
  techCardIn: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#94A3B8", marginTop: 1 },
  techCardTrailHint: { fontSize: 10, fontFamily: "Inter_600SemiBold", textAlign: "right", paddingRight: 10, paddingBottom: 8 },
  // Trail panel
  trailPanel: { position: "absolute", bottom: 0, left: 0, right: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20, shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 10, paddingBottom: Platform.OS === "ios" ? 28 : 4 },
  trailPanelHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderBottomWidth: 1 },
  trailPanelDot: { width: 12, height: 12, borderRadius: 6 },
  trailPanelName: { fontSize: 15, fontFamily: "Inter_700Bold" },
  trailPanelSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  closeBtn: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  // Trail pings
  trailEmpty: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", paddingVertical: 12 },
  pingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  pingBullet: { width: 8, height: 8, borderRadius: 4 },
  pingTime: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  pingAddr: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  liveChip: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, backgroundColor: "#10B98122", borderWidth: 1, borderColor: "#10B98144" },
  liveChipText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#10B981" },
});
