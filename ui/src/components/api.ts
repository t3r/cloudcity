import L from 'leaflet';
import { ref, watchEffect, watch, type Ref } from 'vue';
import { useWebSocket } from '@vueuse/core'
import { uuid } from 'vue-uuid';


export interface ApiCall {
    action: string;
    requestId: string;
}

export interface RegionBounds {
    min: { lat: number; lng: number };
    max: { lat: number; lng: number };
}

export interface ReqionQueryApiCall extends ApiCall {
    action: 'getTileStatus';
    bounds: RegionBounds;
    zoom: number;
}

export interface CloudCityApiProps {
    uri: string;
    bounds?: L.LatLngBounds;
}

export class CloudCityApi {
    public readonly bounds: Ref<L.LatLngBounds|null>;
    public readonly data: Ref<any>;

    private readonly _send: (data: string | ArrayBuffer | Blob, useBuffer?: boolean) => boolean

    constructor(props: CloudCityApiProps) {
        this.bounds = ref(props.bounds ?? null);

        // Establish the websocket connection
        const { status, data, send, open } = useWebSocket(props.uri, {
            autoReconnect: {
                retries: 3,
                delay: 1000,
                onFailed() {
                    alert('Failed to connect WebSocket after 3 retries')
                },
            },

        })
        this._send = send;
        this.data = data;

        // watch our "bounds" property and send a query to the backend on change
        watch(this.bounds, (b) => {
            this.queryRegion(b);
        })

    }

    apiCall( message: ApiCall ) {
        if( this._send ) {
            this._send(JSON.stringify(message));
        }
    }

    queryRegion(bounds: L.LatLngBounds|null ) {
        if( !bounds ) return;
        const width = bounds.getEast() - bounds.getWest();
        const height = bounds.getNorth() - bounds.getSouth();
        const zoom = width * height > 99 ? 2 : 1;
        const message: ReqionQueryApiCall = {
            action: 'getTileStatus',
            requestId: uuid.v4(),
            bounds: {
                min: {
                    lat: bounds.getSouthWest().lat,
                    lng: bounds.getSouthWest().lng
                },
                max: {
                    lat: bounds.getNorthEast().lat,
                    lng: bounds.getNorthEast().lng
                }
            },
            zoom,
         };

        this.apiCall(message);
    }
}
