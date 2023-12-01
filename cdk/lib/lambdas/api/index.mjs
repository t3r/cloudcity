const prefix = '/api/public'

import { db_getTilesFor10x10, db_getTilesFor1x1, db_getTileById, db_updateTileById  } from './dbaccess.mjs'
import * as tile from './fgtile.mjs';

const clamp = (val,min,max) => Math.min( max, Math.max(min,val) );

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

const getTileById = async( id ) => {
  const body = await db_getTileById( id );
  return body.Items;
}

const oneoneregex = /^[ew][01]\d{2}[ns]\d{2}$/
const getTileByOne = async( id ) => {
  console.log(`ENTER getTileByOne(${id})`);
  if( id.match(oneoneregex) ) {
    const body = await db_getTilesFor1x1( id );
    console.log(`LEAVE getTileByOne(${id}): ${JSON.stringify(body)}`);
    return body.Items;
  } else {
    throw new Error('invalid tile format');
  }
}

const tentenregex = /^[ew][01]\d0[ns]\d0$/
const getTileByTen = async( id ) => {
  console.log(`ENTER getTileByTen(${id})`);
  if( id.match(tentenregex) ) {
    const body = await db_getTilesFor10x10( id );
    console.log(`LEAVE getTileByTen(${id}): ${JSON.stringify(body)}`);
    return body.Items;
  } else {
    throw new Error('invalid tile format');
  }
}

const updateTileStatus = ( tile, status ) => {
  return db_updateTileById( tile, { status });
}

const updateTileStatusRebuild = ( tile ) => {
  return updateTileStatus(tile, 'rebuild');
}

const updateTileById = (id, body) => {
  console.log(`ENTER updateTileById(${id},${body})`);
  switch( body.status ) {
    case "rebuild":
      return updateTileStatusRebuild( id )

    default:
      throw Error("Invalid status to update")
  }
}

const updateTileByOne = (id, body) => {
  console.log(`ENTER updateTileByOne(${id},${body})`);
  const tiles = tile.getTilesInFolder( id, 1 ).map( t => t.idx );
  switch( body.status ) {
    case "rebuild":
      return updateTileStatusRebuild( tiles )

    default:
      throw Error("Invalid status to update")
  }
} 

const updateTileByTen = async(id, body) => {
  console.log(`ENTER updateTileByTen(${id},${body})`);
  const tiles = tile.getTilesInFolder( id, 10 ).map( t => t.idx );
  switch( body.status ) {
    case "rebuild":
      return updateTileStatusRebuild( tiles )

    default:
      throw Error("Invalid status to update")
  }
}

const getTileArea = async( parameters ) => {
  console.log(`ENTER getTileArea(${JSON.stringify(parameters)})`);

  const w = Math.floor(clamp(parameters.w ?? 0, -180, 180 ));
  const e = Math.ceil(clamp(parameters.e ?? 0, w, 180 ));
  const s = Math.floor(clamp(parameters.s ?? 0, -90, 90 ));
  const n = Math.ceil(clamp(parameters.n ?? 0, s, 90 ));

  let reply;

  if( e - w >= 10.0 || n - s >= 10.0) {
    // 10x10
    const ww = Math.floor(w/10)*10;
    const ee = Math.ceil(e/10)*10;
    const ss = Math.floor(s/10)*10;
    const nn = Math.ceil(n/10)*10;
    let tiles = [];
    for( let x = ww; x < ee; x+=10 ) {
      for( let y = ss; y < nn; y += 10) {
      let body = await db_getTilesFor10x10( formatGSI( x, y ) );
      tiles = tiles.concat( body.Items );
      }
    }
    reply = formatResponse( tiles );
  } else if( e - w >= 1.0 || n - s >= 1.0) {
    // 1x1
    let tiles = [];
    for( let x = w; x < e; x+=1 ) {
      for( let y = s; y < n; y += 1 ) {
      let body = await db_getTilesFor1x1( formatGSI( x, y ) );
      tiles = tiles.concat( body.Items );
      }
    }
    reply = formatResponse( tiles );
  } else {
    // tile
    const body = await db_getTileById( tile );
    return body.Items;
  }

  console.log(`LEAVE getTileArea(${JSON.stringify(parameters)}): ${JSON.stringify(reply)}`);
  return reply;
}

class Router {
  constructor() {
    this.routes = {
      GET: {},
      POST: {},
      PUT: {},
      DELETE: {},
    };
  }

  route( event ) {
    const v = this.routes[event.httpMethod] ?? {};
    const h = v[event.resource];
    if( h ) return h.call( this, event );
    else throw new Error(`resource or method not found: ${event.httpMethod} ${event.resource}`);
  }

  get( path, handler ) {
    return this._add( 'GET', path, handler );
  }

  post( path, handler ) {
    return this._add( 'POST', path, handler );
  }

  put( path, handler ) {
    return this._add('PUT', path, handler);
  }

  _add( verb, path, handler ) {
    this.routes[verb][path] = handler;
  }
}

const router = new Router();

const isAdmin = (event) => {
  return event.requestContext.authorizer?.claims?.['cognito:groups']?.includes('admin');
}

router.get( '/10x10/{id}', event => {
  return getTileByTen( event.pathParameters.id );
});

router.post( '/10x10/{id}', event => {
  return updateTileByTen( event.pathParameters.id, { status: 'rebuild' }  );
});

router.get( '/1x1/{id}', event => {
  return getTileByOne( event.pathParameters.id );
});

router.post( '/1x1/{id}', event => {
  return updateTileByOne( event.pathParameters.id, { status: 'rebuild' } );
});

router.get( '/tile/{id}', event => {
  return getTileById( event.pathParameters.id );
});

router.post( '/tile/{id}', event => {
  return updateTileById( event.pathParameters.id, { status: 'rebuild' }  );
});

export const handler = async (event, context) => {
  let body;
  let statusCode = 200;
  const headers = {
    "Content-Type": "application/json",
  };

  try {
    console.log("event", JSON.stringify(event));
    body = await router.route(event);
    console.log("response", JSON.stringify(body));
  } 
  catch (err) {
    console.error(err);
    statusCode = 400;
    body = err.message;
  } finally {
    body = JSON.stringify(body);
  }

  return {
    statusCode,
    body,
    headers,
  };
};
/*
!async function test()  {
console.log('**',JSON.stringify(
  await handler(
{
  resource: '/1x1/{id}',
  path: '/1x1/e009n53',
  httpMethod: 'POST',
  queryStringParameters: null,
  multiValueQueryStringParameters: null,
  pathParameters: { id: 'e000n50' },
  requestContext: {
    resourceId: '9mrn5m',
    resourcePath: '/10x10/{id}',
    httpMethod: 'POST',
    requestId: 'aa914fa9-e230-4eac-aa07-74ef44b17e86',
    identity: {
      cognitoIdentityPoolId: null,
      accountId: null,
      cognitoIdentityId: null,
      caller: null,
      sourceIp: '2001:9e8:e3d1:fa00:b0c8:f3d8:be77:35a1',
      principalOrgId: null,
      accessKey: null,
      cognitoAuthenticationType: null,
      cognitoAuthenticationProvider: null,
      userArn: null,
      userAgent: 'Amazon CloudFront',
      user: null
    },
  },
  body: null,
  isBase64Encoded: false
}
)
));
}();
*/
