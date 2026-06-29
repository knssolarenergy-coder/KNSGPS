import { Feather } from "@expo/vector-icons";
import {
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

function buildMapHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0f172a; }
    #map { width: 100vw; height: 100vh; }
    .pin-wrap { position:relative; width:36px; height:36px; }
    .pulse-ring { position:absolute;top:-6px;left:-6px;width:48px;height:48px;border-radius:50%;animation:pulse 2s ease-out infinite;border-width:3px;border-style:solid; }
    @keyframes pulse { 0%{transform:scale(0.6);opacity:0.9;} 100%{transform:scale(1.6);opacity:0;} }
    .pin-label { width:36px;height:36px;border-radius:50% 50% 50% 0;border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;transform:rotate(-45deg);font-weight:800;font-size:14px;color:white;font-family:sans-serif; }
    .pin-label span { transform:rotate(45deg); }
    .leaflet-popup-content-wrapper { border-radius:12px!important;padding:0!important;box-shadow:0 8px 24px rgba(0,0,0,0.18)!important; }
    .leaflet-popup-content { margin:0!important; }
    .popup-inner { padding:12px 14px;min-width:170px; }
    .popup-name { font-weight:700;font-size:14px;margin-bottom:5px; }
    .popup-badge { display:inline-block;font-size:10px;font-weight:700;border-radius:20px;padding:2px 8px;margin-bottom:7px;background:#10B98115;color:#059669;border:1px solid #10B98140; }
    .popup-row { font-size:12px;color:#555;margin-bottom:2px; }
    .popup-ping { font-size:12px;font-weight:600;color:#10B981;margin-top:4px; }
  </style>
</head>
<body>
<div id="map"></div>
<script>
(function() {
  var markerInstances = {};
  var trailPolyline = null;
  var map = L.map('map', { zoomControl: true, attributionControl: false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  map.setView([30.3753, 69.3451], 6);

  function fmtTime(iso) { try { return new Date(iso).toLocaleTimeString('en-PK',{hour:'2-digit',minute:'2-digit',hour12:true}); } catch(e){ return iso; } }
  function minsAgo(iso) { var diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000); if(diff < 1) return 'just now'; if(diff === 1) return '1 min ago'; if(diff < 60) return diff + ' min ago'; return Math.floor(diff/60) + 'h ' + (diff%60) + 'm ago'; }
  function cap(s) { return s.replace(/-/g,' ').replace(/\\b\\w/g,function(c){return c.toUpperCase();}); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }

  function makeIcon(color, initial) {
    return L.divIcon({ className: '', html: '<div class="pin-wrap"><div class="pulse-ring" style="border-color:'+color+'55"></div><div class="pin-label" style="background:'+color+'"><span>'+esc(initial)+'</span></div></div>', iconSize:[36,36], iconAnchor:[18,36], popupAnchor:[0,-42] });
  }
  function makePopup(d) {
    return '<div class="popup-inner"><div class="popup-name" style="color:'+d.color+'">'+esc(d.name)+'</div><div class="popup-badge">● '+cap(d.status)+'</div>'+(d.checkInAt?'<div class="popup-row">🕐 In: '+fmtTime(d.checkInAt)+'</div>':'')+'<div class="popup-row">📍 '+d.lat.toFixed(5)+', '+d.lng.toFixed(5)+'</div>'+(d.address?'<div class="popup-row">'+esc(d.address)+'</div>':'')+'<div class="popup-ping">📡 '+minsAgo(d.recordedAt)+'</div></div>';
  }

  function setMarkers(data) {
    var latlngs = []; var seen = {};
    data.forEach(function(d) {
      if(isNaN(d.lat)||isNaN(d.lng)) return;
      seen[d.id] = true; latlngs.push([d.lat, d.lng]);
      if(markerInstances[d.id]) { markerInstances[d.id].setLatLng([d.lat,d.lng]); markerInstances[d.id].setPopupContent(makePopup(d)); }
      else { var m = L.marker([d.lat,d.lng],{icon:makeIcon(d.color,d.name.trim().charAt(0).toUpperCase())}).bindPopup(makePopup(d),{maxWidth:220}).addTo(map); markerInstances[d.id] = m; }
    });
    Object.keys(markerInstances).forEach(function(id){ if(!seen[id]){ map.removeLayer(markerInstances[id]); delete markerInstances[id]; } });
    return latlngs;
  }

  var hasFitted = false;
  function fitView(latlngs) {
    if(hasFitted) return;
    if(latlngs.length === 1) { map.setView(latlngs[0], 14); hasFitted = true; }
    else if(latlngs.length > 1) { map.fitBounds(latlngs, {padding:[48,48], maxZoom:14}); hasFitted = true; }
  }

  window.addEventListener('message', function(e) {
    if(!e.data) return;
    if(e.data.type === 'UPDATE_MARKERS') { fitView(setMarkers(e.data.markers)); }
    else if(e.data.type === 'SHOW_TRAIL') {
      if(trailPolyline) { map.removeLayer(trailPolyline); trailPolyline = null; }
      if(e.data.latlngs && e.data.latlngs.length > 0) {
        trailPolyline = L.polyline(e.data.latlngs, {color: e.data.color || '#3B82F6', weight: 4, opacity: 0.75}).addTo(map);
        map.setView(e.data.latlngs[e.data.latlngs.length - 1], Math.max(map.getZoom(), 14));
      }
    } else if(e.data.type === 'CLEAR_TRAIL') {
      if(trailPolyline) { map.removeLayer(trailPolyline); trailPolyline = null; }
    }
  });
})();
</script>
</body>
</html>`;
}

export function LiveMapSection() {
  const colors = useColors();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const mapReadyRef = useRef(false);
  const [mapKey] = useState(0);
  const [selectedTechId, setSelectedTechId] = useState<string | null>(null);
  const selectedColorRef = useRef<string>("#3B82F6");
  const locsRef = useRef<Array<{ id: string; lat: number; lng: number; name: string; color: string; status: string; checkInAt: string | null; recordedAt: string; address: string; isStale: boolean }>>([]);

  const { data: locations, isRefetching, isLoading } = useGetTechnicianLiveLocations({
    query: { queryKey: ["tech-live-section"], refetchInterval: 30_000 },
  });

  // Rolling last-24h trail for the selected technician — spans attendance
  // sessions so overnight movement stays visible after midnight.
  const { data: trail, isLoading: trailLoading } = useGetTechnicianTrail(
    selectedTechId ?? "",
    { query: { queryKey: ["trail-section", selectedTechId], enabled: !!selectedTechId, refetchInterval: selectedTechId ? 30_000 : false } }
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
      status: loc.status,
      checkInAt: loc.checkInAt ?? null,
      recordedAt: loc.recordedAt,
      address: loc.address ?? "",
      isStale: loc.isStale,
    }));
  }
  locsRef.current = buildPayload();

  function pushMarkers() {
    if (!mapReadyRef.current) return;
    iframeRef.current?.contentWindow?.postMessage({ type: "UPDATE_MARKERS", markers: locsRef.current }, "*");
  }

  useEffect(() => { pushMarkers(); }, [locations]);

  useEffect(() => {
    if (!mapReadyRef.current) return;
    if (!selectedTechId) {
      iframeRef.current?.contentWindow?.postMessage({ type: "CLEAR_TRAIL" }, "*");
      return;
    }
    if (!trail || trail.length === 0) {
      iframeRef.current?.contentWindow?.postMessage({ type: "CLEAR_TRAIL" }, "*");
      return;
    }
    const valid = trail.filter(p => !isNaN(parseFloat(p.latitude)) && !isNaN(parseFloat(p.longitude)));
    const latlngs = valid.map(p => [parseFloat(p.latitude), parseFloat(p.longitude)]);
    iframeRef.current?.contentWindow?.postMessage({ type: "SHOW_TRAIL", latlngs, color: selectedColorRef.current }, "*");
  }, [trail, selectedTechId]);

  const htmlContent = useMemo(() => buildMapHtml(), []);

  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      <View style={[s.mapWrapper, { borderColor: colors.border }]}>
        {/* @ts-ignore — iframe is valid DOM element in Expo web */}
        <iframe
          key={mapKey}
          ref={iframeRef}
          srcDoc={htmlContent}
          style={{ width: "100%", height: "100%", border: "none", borderRadius: 0, display: "block" }}
          onLoad={() => { mapReadyRef.current = true; pushMarkers(); }}
          title="Live Technician Map"
          sandbox="allow-scripts"
        />
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
                    if (mapReadyRef.current) iframeRef.current?.contentWindow?.postMessage({ type: "CLEAR_TRAIL" }, "*");
                  } else {
                    setSelectedTechId(loc.technicianId);
                    selectedColorRef.current = pinColor;
                    if (mapReadyRef.current) iframeRef.current?.contentWindow?.postMessage({ type: "CLEAR_TRAIL" }, "*");
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
