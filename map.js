import * as maplibregl
    from 'https://unpkg.com/maplibre-gl@6.10.0/dist/maplibre-gl.mjs';

const map = new maplibregl.Map({
    container: 'map',

    // OpenFreeMap
    style: 'https://tiles.openfreemap.org/styles/dark',

    center: [-9.312, 38.697],
    zoom: 15,

    // Navigation-style camera
    pitch: 50,
    bearing: 0,
    attributionControl: false,
    missingStyleImageResolver: () => {
        return;
    }
});

async function loadImgs() {
    const icons = [
        ["bus-regular", "bus-regular.png"],
        ["bus-delay", "bus-delay.png"],
        ["bus-issue", "bus-error.png"]
    ];

    for (let [n, p] of icons) {
        let image = await map.loadImage(p);

        if (!map.hasImage(n)) {
            await map.addImage(n, image.data);
        }
    }
}

map.on('load', async () => {
    console.log('Map loaded!');
    await loadImgs();
    map.addSource("main-bus", {
        type: "geojson",

        data: {
            type: "FeatureCollection",
            features: []
        }
    });
    map.addSource("other-bus", {
        type: "geojson",

        data: {
            type: "FeatureCollection",
            features: []
        }
    });
    map.addLayer({
        id: "main-bus",
        type: "symbol",
        source: "main-bus",

        layout: {
            "icon-image": [
                "match",

                ["get", "status"],

                "delay", "bus-delay",
                "issue", "bus-issue",
                "regular", "bus-regular",
                "bus"
            ],

            "icon-size": 0.15,

            "icon-anchor": "center",

            "icon-rotation-alignment": "map",
            "icon-pitch-alignment": "map",

            "icon-rotate": [
                "get",
                "heading"
            ],

            "icon-allow-overlap": true
        }
    });

    map.addLayer({
        id: "other-bus",
        type: "symbol",
        source: "other-bus",

        layout: {
            "icon-image": [
                "match",

                ["get", "status"],

                "delay", "bus-delay",
                "issue", "bus-issue",
                "regular", "bus-regular",
                "bus"
            ],

            "icon-size": 0.075,

            "icon-anchor": "center",

            "icon-rotation-alignment": "map",
            "icon-pitch-alignment": "map",

            "icon-rotate": [
                "get",
                "heading"
            ],

            "icon-allow-overlap": true
        }
    });

});

window.updateOtherCars = (vehicles) => {
    map.getSource("other-bus").setData({
        type: "FeatureCollection",

        features: 
            vehicles.map(v => ({
                type: "Feature",

                properties: {
                    id: v.id,
                    heading: v.bearing,
                    status: "delay"
                },

                geometry: {
                    type: "Point",

                    coordinates: [
                        v.lon,
                        v.lat
                    ]
                }
            })
            )
        
    });
}

window.moveMapToLatLon = (vehicle) => {
    map.easeTo({
        center: [vehicle.lon, vehicle.lat],
        bearing: vehicle.bearing,
        pitch: 50,

        zoom: 16,

        padding: {
            top: 250,
            bottom: 0,
            left: 0,
            right: 0
        },

        duration: 500
    });

    map.getSource("main-bus").setData({
        type: "FeatureCollection",

        features: [
            {
                type: "Feature",

                properties: {
                    id: vehicle.id,
                    heading: vehicle.bearing,
                    status: "regular"
                },

                geometry: {
                    type: "Point",

                    coordinates: [
                        vehicle.lon,
                        vehicle.lat
                    ]
                }
            }
        ]
    });

}