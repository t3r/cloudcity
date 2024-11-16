<script setup lang="ts">
import { watch, ref,  onMounted, onUnmounted, type Ref} from 'vue';
import "leaflet/dist/leaflet.css";
import * as L from 'leaflet';
import "./tilestatuslayer.js"
import 'leaflet-graticule/Leaflet.Graticule.js'
import 'leaflet.coordinates/dist/Leaflet.Coordinates-0.1.5.min.js'
import 'leaflet.coordinates/dist/Leaflet.Coordinates-0.1.5.css'
import * as fgtile from './fgtile'

let map: L.Map;

import { CloudCityApi } from './api';

const cloudCityApi = new CloudCityApi({
  // uri: `${(window.location.protocol === 'https:' ? 'wss' : 'ws')}://${window.location.host}/dev`,
  uri: 'wss://cloudcity.flightgear.org/dev',
});

interface ApiEvent {
  timeStamp: number;
  type: string;
  tile: number;
  status: string;
}

const apiEvents = ref<ApiEvent[]>([]);

watch( cloudCityApi.data, (value) => {
  let x;
  try {
    x = JSON.parse( value );
  }
  catch( ex ) {
    console.error("can't parse ncoming data as json.", value );
    return;
  }

  if( Array.isArray( x ) ) {

    // {
    //   event: 'MODIFY',
    //   item: { tile: 12345, one_one: 'e000n00', ten_ten: 'e000n00', status: 'done' }
    // }

    x.forEach(element => {
      switch( element.event ) {
        case 'MODIFY':
          apiEvents.value.push( { timeStamp: Date.now(), type: 'modify', tile: element.item.tile, status: element.item.status } );
          map.fire("modify-tile", { data: element })
          break;

        default:
          console.error("ignoring unhandled event", x );
          break;
      }
    });


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

    (L.control as any).coordinates({
      position:"bottomleft",
      decimals:6,
      decimalSeperator:",",
      labelTemplateLat:"Lat: {y}",
      labelTemplateLng:"Lng: {x}",
      useLatLngOrder:false,
    }).addTo(map);

    (L.control as any).coordinates({
      position:"bottomleft",
      useDMS:true,
      labelTemplateLat:"Lat: {y}",
      labelTemplateLng:"Lng: {x}",
      useLatLngOrder:false,
    }).addTo(map);

    (L.control as any).coordinates({
      position:"bottomleft",
      customLabelFcn: function(ll: L.LatLng ) {
        return `${fgtile.getDirFromCoordinate(ll.lat,ll.lng,10)}/`+
               `${fgtile.getDirFromCoordinate(ll.lat,ll.lng,1)}/`+
               `${fgtile.tileIndexFromCoordinate(ll.lat,ll.lng)}`;
      },
    }).addTo(map);
    setTimeout(() => handleBoundsChange(), 100 );
  }
});
</script>

<template>
   <div class="container-fluid h-100">
    <div class="row h-100">
      <div class="col-10 p-0">
        <div id="map">Hi - there is no map here, obviously. This is a bug.</div>
      </div>
      <div class="col-2 p-0">
          <div class="list-group" style="max-height: 100vh; overflow-y: auto;">
            <div class="list-group-item list-group-item-action">
              <div v-for="event in apiEvents" :key="event.timeStamp" class="list-group-item list-group-item-action">
                <small>{{ new Date(event.timeStamp).toLocaleTimeString() }}:
                  <i class="bi-hourglass-top" v-if="event.status == 'rebuild'"></i>
                  <i class="bi-hourglass-split" v-if="event.status == 'processing'"></i>
                  <i class="bi-check-circle" v-if="event.status == 'done'"></i>
                  <i class="bi-bug" v-if="event.status == 'error'"></i>
                  {{ event.tile }}</small>
              </div>
            </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="css" scoped>
#map {
  height: 100%;
  width: 100%;
}

</style>
