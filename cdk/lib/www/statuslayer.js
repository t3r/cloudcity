class StatusSocket extends EventTarget {
  constructor() {
    super();
    this.uri = `${(window.location.protocol === 'https:' ? 'wss' : 'ws')}://${window.location.host}${window.location.pathname}dev`;
    //this.uri = 'https://r44cap6aie.execute-api.eu-central-1.amazonaws.com/dev/'
  }

  connect() {
    this.interval = setInterval(this._connect.bind(this), 1000 );
  }

  _connect() {
    // https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/readyState
    if (this.ws && this.ws.readyState <= WebSocket.OPEN )
      return;

    try {
      this.ws = new WebSocket(this.uri);
      this.ws.onclose = (e) => console.log("ws closed",e);
      this.ws.onerror = (e) => console.log("ws error",e);
      this.ws.onopen = (e) => { console.log("open");this.dispatchEvent(new MessageEvent('open', { e }) )};
      this.ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          console.log("received", data );
          this.dispatchEvent(new MessageEvent('message', { data }));
        }
        catch( ex ) {
          console.error("Can't parse message", ex);
        }
      }
    }
    catch( ex ) {
      //setConnected(false);
      console.error(`Can't connect to ${this.uri}`, ex);
    }
  }

  close() {
    if( this.interval ) {
      clearInterval( this.interval );
      this.ws.close();
    }
  }
  send(data) {
    console.log("sending", data );
    this.ws.send(JSON.stringify(data));
  }
}

const getTileBounds = (tile) => {
  const x = (tile >> 0) & 0x07;
  const y = (tile >> 3) & 0x07;
  const lat = (((tile >> 6) & 0xff) - 90.0) + 0.125*y;
  const lon = ((tile >> 14)) - 180.0;
  const c = {
    s: lat,
    n: lat + 0.125,
    w: lon + x * tileWidth(lat),
    e: lon + (x+1) * tileWidth(lat),
  }
  return c;
}

const normdeg = (v,min,max) => {
  const range = max - min;
  if( range < Number.MIN_VALUE ) return min;
  const normalized = v - range*Math.floor((v - min)/range);
  if( normalized <= min ) return min;
  if( max <= normalized ) return min;
  return normalized;
}

const clamp = (val,min,max) => Math.min( max, Math.max(min,val) );

const formatResponse = ( tiles ) => {
  const reply = {};
  tiles.forEach( t => {
    const ten_ten = reply[t.ten_ten] || {}
    reply[t.ten_ten] = ten_ten;

    const one_one = ten_ten[t.one_one] || []
    ten_ten[t.one_one] = one_one;
    one_one.push({
      tile: t.tile,
      status: t.status,
      timestamp: t.timestamp,
    });
  });
  return reply;
}

const getSign = ( a, v ) => {
  return v >= 0 ? a[1] : a[0];
}

const formatGSI = ( x, y ) => {
  const ew = getSign( "we", x );
  const sn = getSign( "sn", y );
  x = ('' + x * Math.sign(x)).padStart(3,'0');
  y = ('' + y * Math.sign(y)).padStart(2,'0');

  return `${ew}${x}${sn}${y}`
}

const tileDirToLatLng = ( dirname ) => {
  let lon = Number( dirname.substring(1,4) );
  if( dirname.substring(0,1).toLowerCase() == 'w' )
    lon *= -1;
  let lat = Number( dirname.substring(5) );
  if( dirname.substring(4,5).toLowerCase() == 's' )
    lat *= -1;
  return { lat, lon }
}

L.StatusLayer = L.FeatureGroup.extend({
  options: {
    tilesAtZoom: 8,
  },

  onAdd( map ) {
    L.FeatureGroup.prototype.onAdd.call( this, map );
    this._map = map;
    map.on('resize', this.refresh, this );
    map.on('moveend', this.refresh, this );
    map.on('rebuild-tile', this.rebuildTile, this)
    this.statusSocket = new StatusSocket();
    this.statusSocket.addEventListener( 'message', this );
    this.statusSocket.addEventListener( 'open', e => { this.refresh() } );

    this.statusSocket.connect();
  },

  onRemove( map ) {
    this.statusSocket.close();

    map.off('moveend', this.refresh, this );
    map.off('resize', this.refresh, this );
    map.off('rebuild-tile', this.rebuildTile, this)
    L.FeatureGroup.prototype.onRemove.call( this, map );
  },

  async rebuildTile(evt) {
    let response;
    switch( evt.scope ) {
      case 'tile':
        response = await axios.post(`api/tile/${evt.tile}`);
        console.log(response)
        break;

      case '1x1':
        response = await axios.post(`api/1x1/${evt.tile}`);
        break;
      case '10x10':
        response = await axios.post(`api/10x10/${evt.tile}`);
        break;
    }
  },

  async handleEvent(evt) {
    data = evt.data;
    if( data.length ) {
      this.renderTiles( 
        // [{"event":"MODIFY","item":{"tile":3105800,"one_one":"e009n54","ten_ten":"e000n50","status":"error","timestamp":1}}]
        // [{"tile":3105800,"one_one":"e009n54","ten_ten":"e000n50","status":"error","timestamp":1]
        data.map( d => { return { tile: Number((d.item??d).tile), status: (d.item??d).status } } )
      );
    }
  },

  async refresh() {
    const zoom = this._map.getZoom();
    const bounds = this._map.getBounds();

    const w = bounds.getWest();
    const e = bounds.getEast();
    const s = bounds.getSouth();
    const n = bounds.getNorth();   
     
    const tilesize = e - w > 3 || n - s > 3 ? 10 : 1;
    const endpoint = tilesize == 1 ? 'OneOne' : 'TenTen';
  
    const xspan = e - w;
  
    const ww = Math.floor(w/tilesize)*tilesize;
    const ee = Math.ceil(e/tilesize)*tilesize;
    const ss = Math.floor(s/tilesize)*tilesize;
    const nn = Math.ceil(n/tilesize)*tilesize;
  
    let tiles = [];
    for( let x = ww; x < ee; x+=tilesize ) {
      for( let y = ss; y < nn; y += tilesize) {
        tiles.push( formatGSI(x,y));
      }
    }
    this.statusSocket.send( { action: `get${endpoint}`, key: tiles })
  },

  renderTenTen(tenten, tile) {
    if( !tile ) return;
    let cls;
    [ 'error', 'inprogress', 'done', 'rebuild' ].forEach( status => {
      for( let oneone in tile ) {
        const t1 = tile[oneone];
        if( !cls && t1.find( t => status === t.status ) ) cls = status;
      }
    });
    if( !cls ) return

    const b = tileDirToLatLng( tenten );
    const tr = L.rectangle([[b.lat,b.lon],[b.lat+10,b.lon+10]], {className: `status-${cls}` });
    tr.bindPopup(buildTilePopup(tile));
    tr.addTo(this);
  },

  renderOneOne(oneone, tile) {
    if( !tile ) return;
    let cls;
    [ 'error', 'inprogress', 'done', 'rebuild' ].forEach( status => {
      if( !cls && tile.find( t => status === t.status ) ) cls = status;
    });
    if( !cls ) return

    const b = tileDirToLatLng( oneone );
    const tr = L.rectangle([[b.lat,b.lon],[b.lat+1,b.lon+1]], {className: `status-${cls}` });
    tr.bindPopup(buildTilePopup(tile));
    tr.addTo(this);
  },

  findTile( tile ) {
    const l = Object.keys( this._layers );
    const layerId = l.find( x => this._layers[x]._tile == tile, this );
    if( layerId ) return this._layers[layerId];
  },

  renderTiles(tiles) {
    for( t of tiles ) {
      let tileLayer = this.findTile( t.tile );
      if(tileLayer ) tileLayer.removeFrom(this);
      
      const b = getTileBounds( t.tile );
      const tr = L.rectangle([[b.s,b.w],[b.n,b.e]], {className: `status-${t.status}` });
      tr._tile = t.tile;
      tr.bindPopup(buildTilePopup(t));
      tr.bindTooltip(''+t.tile, {permanent: true, direction:"center",className:'tile-label'}).openTooltip()
      tr.addTo(this);
    };
  }
});

L.statusLayer = function(options) {
  return new L.StatusLayer(null,options);
}

function buildTilePopup(t) {
  return `
    <table>
      <tr>
        <th>tile</th><td>${t.tile}</td>
      </tr>
      <tr>
        <th>status</th><td>${t.status}</td>
      </tr>
      <tr>
        <th>time</th><td>${t.timestamp}</td>
      </tr>
      <tr>
        <td colspan="2">trigger <a href="#">rebuild</a></td>
      </tr>
    </table>
  `
}
