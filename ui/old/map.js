const url = new URL(location.href);
const parsedHash = new URLSearchParams(
  location.hash.substring(1) // any_hash_key=any_value
);

let token = {
  id: parsedHash.get( 'id_token' ),
  access: parsedHash.get( 'access_token' ),
  expires_in: parsedHash.get( 'expires_in' ),
  type: parsedHash.get( 'token_type' ),
}

if( token.id ) {
  document.cookie = 
    `cloudcity-token=${encodeURIComponent(JSON.stringify(token))}; max-age=${token.expires_in}; samesite=Strict`
  location.href = location.href.substring(0,location.href.search(url.hash));
} else {
  const tokenCookie = document.cookie.split("; ")
    .find((row) => row.startsWith("cloudcity-token="))
    ?.split("=")[1];
  if( tokenCookie ) {
    token = JSON.parse(decodeURIComponent(tokenCookie));
  }
}

if( token && token.id ) {
  axios.defaults.headers.common['Authorization'] = token.id;
}

function tileWidth(lat) {
  lat = Math.abs(lat);
  if( lat < 22 ) return 1.0/8.0;
  if( lat < 62 ) return 1.0/4.0;
  if( lat < 76 ) return 1.0/2.0;
  if( lat < 83 ) return 1.0/1.0;
  if( lat < 86 ) return 2.0/1.0;
  if( lat < 88 ) return 4.0/1.0;
  if( lat < 89 ) return 8.0/1.0;
  return 360.0;
}

function tileIndexFromCoordinate (ll) {
  const lat = ll.lat;
  const lon = ll.lng;
  const base_y    = Math.floor(lat);
  const y         = Math.trunc((lat-base_y)*8);
  const tilewidth = tileWidth(lat);
  const base_x    = Math.max(-180,Math.floor(Math.floor( lon / tilewidth )* tilewidth ));
  const x         = Math.trunc(Math.floor((lon-base_x)/tilewidth));
  const tile = Math.trunc(((Math.trunc(Math.floor(lon))+180)<<14) + ((Math.trunc(Math.floor(lat))+ 90) << 6) + (y << 3) + x);
  return tile;
}
L.Map.prototype.getTileFolder = function(ll, f) {
  return getTileFolder(ll, f);
}

function getTileFolder(ll,f) {
  let o = Math.floor( ll.lng/f ) * f
  let ew = "e"
  if( o < 0 ) {
    ew = "w"
    o = -o
  }
  let n = Math.floor( ll.lat/f ) * f
  let ns = "n"
  if( n < 0 ) {
    n = -n
    ns = "s"
  }
  return `${ew}${String(o).padStart(3,'0')}${ns}${String(n).padStart(2,'0')}`
}

const center = JSON.parse( localStorage.getItem( 'map-center' ) ?? null ) ?? { lat: 53, lng: 10 };
const Z = localStorage.getItem( 'map-zoom') ?? 8;
let map = L.map('map', {
  contextmenu: true,
  contextmenuItems: [{
    text: 'Rebuild this tile',
    callback: e => {
      map.fire("rebuild-tile", { scope: "tile", latlng: e.latlng, tile: tileIndexFromCoordinate(e.latlng)})
    },
  },{
    text: 'Rebuild tiles in this 1x1',
    callback: e => { 
      map.fire("rebuild-tile", { scope: "1x1", latlng: e.latlng, tile: getTileFolder(e.latlng,1)})
    },
  },{
    text: 'Rebuild tiles in this 10x10',
    callback: e => { 
      map.fire("rebuild-tile", { scope: "10x10", latlng: e.latlng, tile: getTileFolder(e.latlng,10)})
    },
  }]
}).setView([center.lat,center.lng], Z);
map.on('zoomend', () => { localStorage.setItem( 'map-zoom', map.getZoom())  } );
map.on('moveend', () => { localStorage.setItem( 'map-center', JSON.stringify(map.getCenter()) ) } );

mapLink = '<a href="https://openstreetmap.org">OpenStreetMap</a>';
L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; ' + mapLink + ' Contributors',
    minZoom: 3,
    maxZoom: 10,
}).addTo(map);

L.latlngGraticule({
    showLabel: true,
    dashArray: [5, 5],
    zoomInterval: [
        {start: 2, end: 4, interval: 10},
        {start: 5, end: 10, interval: 1}
    ]
}).addTo(map);

L.statusLayer().addTo(map);

L.control.coordinates({
    position:"bottomleft",
    decimals:6,
    decimalSeperator:",",
    labelTemplateLat:"Lat: {y}",
    labelTemplateLng:"Lng: {x}",
    useLatLngOrder:true,
}).addTo(map);

L.control.coordinates({
   position:"bottomleft",
   customLabelFcn: function(ll,opts) {
     return `${getTileFolder(ll,10)}/${getTileFolder(ll,1)}/${tileIndexFromCoordinate(ll)}`
   },
}).addTo(map);

const personal = L.control({position: 'topright'});
personal.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'leaflet-bar');
    div.innerHTML += `<a href="/api/login" title="Login" role="button" aria-label="Login"><i class="fa fa-user-o"></i></a>`;
    return div;
};
personal.addTo(map);

