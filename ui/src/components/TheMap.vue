<script setup lang="ts">
import { ref, watchEffect, onMounted, onUnmounted, type Ref} from 'vue';
import { storeToRefs } from 'pinia'
import "leaflet/dist/leaflet.css";
import * as L from 'leaflet';
import "./tilestatuslayer.js"
import 'leaflet-graticule/Leaflet.Graticule.js'

let map: L.Map;

import { CloudCityApi } from './api';

const cloudCityApi = new CloudCityApi({
  // uri: `${(window.location.protocol === 'https:' ? 'wss' : 'ws')}://${window.location.host}/dev`,
  uri: 'wss://cloudcity.flightgear.org/dev',
  bounds: L.latLngBounds(L.latLng(0,0), L.latLng(0,0)),
});

let boundsChangeTimeout: number | null = null;
const handleBoundsChange = () => {
  if (boundsChangeTimeout) {
    clearTimeout(boundsChangeTimeout);
  }

  boundsChangeTimeout = window.setTimeout(() => {
    cloudCityApi.bounds.value = map.getBounds();
  }, 1000);
};

// Clean up the timeout when component is unmounted
onUnmounted(() => {
  if (boundsChangeTimeout) {
    clearTimeout(boundsChangeTimeout);
  }
});

onMounted(()=> {

  const resizeObserver = new ResizeObserver(() => {
    map.invalidateSize();
  });

  const mapElement = document.getElementById('map');
  if( mapElement ) {
    resizeObserver.observe(mapElement);

    const center = JSON.parse( localStorage.getItem( 'map-center' ) ?? 'null' ) ?? { lat: 53, lng: 10 };
    const Z = Number(localStorage.getItem( 'map-zoom') ?? 8);
    map = L.map(mapElement).setView([center.lat,center.lng], Z);
    map.on('zoomend', () => { localStorage.setItem( 'map-zoom', map.getZoom().toString())  } );
    map.on('moveend', () => { localStorage.setItem( 'map-center', JSON.stringify(map.getCenter()) ) } );

    // Add event listeners for both zoom and move events
    map.on('moveend', handleBoundsChange);
    map.on('zoomend', handleBoundsChange);

    const mapLink = '<a href="https://openstreetmap.org">OpenStreetMap</a>';
    L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; ' + mapLink + ' Contributors',
        minZoom: 3,
        maxZoom: 10,
    }).addTo(map);

    (L as any).latlngGraticule({
        showLabel: true,
        dashArray: [5, 5],
        zoomInterval: [
            {start: 2, end: 4, interval: 10},
            {start: 5, end: 10, interval: 1}
        ]
    }).addTo(map);

    (L as any).tileStatusLayer().addTo(map);

  }
});
</script>

<template>
  <div id="map">Hi - there is no map here, obviously. This is a bug.</div>
</template>

<style lang="css" scoped>
#map {
  height: 100%;
  width: 100%;
}
</style>
