import * as maplibregl
    from 'https://unpkg.com/maplibre-gl@6.10.0/dist/maplibre-gl.mjs';

const map = new maplibregl.Map({
    container: 'map',

    // OpenFreeMap
    style: 'https://tiles.openfreemap.org/styles/bright',

    center: [-9.312, 38.697],
    zoom: 15,

    // Navigation-style camera
    pitch: 40,
    bearing: 0,
    attributionControl: false,
    missingStyleImageResolver: () => {
        return;
    }
});

let otherBusFeatures;
let thisBusFeatures;
let thisRouteFeatures;

let snapped = true;

window.snapToVehicle = (v) => {
    snapped = true;
    moveMapToLatLon(v)
}

window.setTheme = (isDarkMode) => {
    map.setStyle(isDarkMode ? 'https://tiles.openfreemap.org/styles/dark' : 'https://tiles.openfreemap.org/styles/bright');
}

async function loadImgs() {
    const icons = [
        ["bus-regular", "bus-regular.png"],
        ["bus-delay", "bus-delay.png"],
        ["bus-issue", "bus-error.png"],
        ["bus-mobi", "bus-mobi.png"]
    ];

    for (let [n, p] of icons) {
        let image = await map.loadImage(p);

        if (!map.hasImage(n)) {
            await map.addImage(n, image.data);
        }
    }
}

map.on('dragstart', () => {
    snapped = false;
    recenterBtn.style.display = "block";
});

map.on('style.load', async () => {
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

    map.addSource("main-route", {
        type: "geojson",

        data: {
            type: "line"
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

            "icon-size": 0.25,

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
                "mobi", "bus-mobi",
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
    }, 'main-bus');

    map.addLayer({
        id: "main-route",
        type: "line",
        source: "main-route",
        paint: {
            'line-color': '#C61D23',
            'line-width': 5
        }
    }, 'other-bus');

    if (otherBusFeatures) {
        map.getSource("other-bus").setData({
            type: "FeatureCollection",

            features:
                otherBusFeatures

        });
    }

    if (thisBusFeatures) {
        map.getSource("main-bus").setData({
            type: "FeatureCollection",

            features:
                thisBusFeatures

        });
    }

    console.log(thisRouteFeatures)

    if (thisRouteFeatures) {
        map.getSource("main-route").setData({
            type: 'FeatureCollection',
            features: [thisRouteFeatures]
        })
    }

});

window.updateOtherCars = (vehicles) => {
    vehicles = vehicles.filter(z => (Date.now() - z.timestamp) < 15 * 60 * 1000)
    otherBusFeatures = vehicles.map(v => ({
        type: "Feature",

        properties: {
            id: v.id,
            heading: v.bearing,
            status: (v.agency_id === "HF16N" ? "mobi" : isSimilarLine(v) ? "regular" : "delay")
        },

        geometry: {
            type: "Point",

            coordinates: [
                v.lon,
                v.lat
            ]
        }
    })
    );
    map.getSource("other-bus").setData({
        type: "FeatureCollection",

        features:
            otherBusFeatures

    });
}

window.moveMapToLatLon = (vehicle) => {
    if (!vehicle.lon || !vehicle.lat) return;
    if (snapped) {

        recenterBtn.style.display = "none";
        map.easeTo({
            center: [vehicle.lon, vehicle.lat],
            bearing: vehicle.bearing,
            pitch: 55,

            zoom: 16,

            padding: {
                top: 250,
                bottom: 0,
                left: 0,
                right: 0
            },

            duration: 500
        });
    }

    thisBusFeatures = [
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
    map.getSource("main-bus").setData({
        type: "FeatureCollection",

        features: thisBusFeatures
    });

}

window.drawMainRoute = (route) => {
    thisRouteFeatures = route;
    map.getSource("main-route").setData({
        type: 'FeatureCollection',
        features: [thisRouteFeatures]
    })
}

function isSimilarLine(v) {
    let vLine = v.line_id;
    console.log(vLine)
    switch (currentLine) {
        case "1614":
            return vLine === "1618" || vLine === "1614";
        case "1618":
            return vLine === "1618" || vLine === "1614";
        case "1615":
            return vLine === "1615" || vLine === "1619";
        case "1619":
            return vLine === "1615" || vLine === "1619";
        case "1622":
            return vLine === "1613" || vLine === "1622";
        case "1613":
            return vLine === "1613" || vLine === "1622";
        default:
            return vLine === currentLine;
    }
}


window.decodeShape = (shape) => {
    const points = polyline.decode(shape, 6);
    const coordinates = points.map(([lat, lon]) => [lon, lat]);
    return {
        type: 'Feature',
        geometry: {
            type: 'LineString',
            coordinates: coordinates
        },
        properties: {}
    };
}
