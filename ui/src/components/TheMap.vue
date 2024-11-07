<script setup lang="ts">
import { watch, onMounted, onUnmounted, type Ref} from 'vue';
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
});

watch( cloudCityApi.data, (value) => {
  let x;
  try {
    x = JSON.parse( value );
    // console.log("map has data", x );
  }
  catch( ex ) {
    console.error("can't parse ncoming data as json.", value );
    return;
  }

  if( "OK" !== x.status ) {
    console.error("Error response - ignoring.", x );
    return;
  }

  if( map === undefined ) {
    console.log("map is not defined, ignoring data");
    return;
  }

  if( x.oneOnes) {
    console.log("rendering 1x1", x.oneOnes);
    map.fire("render-oneone", { data: x.oneOnes } );
  }
  if( x.tenTens) {
    console.log("rendering 10x10", x.tenTens);
    map.fire("render-tenten", { data: x.tenTens });
  }
})

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
    map.on('moveend zoomend', handleBoundsChange);

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

    setTimeout(() => handleBoundsChange(), 100 );
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
