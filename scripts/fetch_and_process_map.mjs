
import fs from 'fs';
import https from 'https';
import { geoMercator, geoPath } from 'd3-geo';

const MAP_URL = 'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json';
const OUTPUT_FILE = 'src/constants/mapData.ts';

// Mapping from Chinese name (simplified) to our IDs
const NAME_TO_ID = {
    '安徽省': 'anhui',
    '北京市': 'beijing',
    '重庆市': 'chongqing',
    '福建省': 'fujian',
    '甘肃省': 'gansu',
    '广东省': 'guangdong',
    '广西壮族自治区': 'guangxi-zhuang',
    '贵州省': 'guizhou',
    '海南省': 'hainan',
    '河北省': 'hebei',
    '黑龙江省': 'heilongjiang',
    '河南省': 'henan',
    '湖北省': 'hubei',
    '湖南省': 'hunan',
    '江苏省': 'jiangsu',
    '江西省': 'jiangxi',
    '吉林省': 'jilin',
    '辽宁省': 'liaoning',
    '内蒙古自治区': 'nei-mongol',
    '宁夏回族自治区': 'ningxia-hui',
    '青海省': 'qinghai',
    '陕西省': 'shaanxi',
    '山东省': 'shandong',
    '上海市': 'shanghai',
    '山西省': 'shanxi',
    '四川省': 'sichuan',
    '天津市': 'tianjin',
    '香港特别行政区': 'hong-kong',
    '新疆维吾尔自治区': 'xinjiang-uygur',
    '西藏自治区': 'xizang',
    '云南省': 'yunnan',
    '浙江省': 'zhejiang',
    '澳门特别行政区': 'macau',
    '台湾省': 'taiwan'
};

const PROJECTION_CONFIG = {
    scale: 1000, 
    center: [105, 35], 
    translate: [400, 300]
};

function fetchMapData() {
    return new Promise((resolve, reject) => {
        https.get(MAP_URL, (res) => {
            res.setEncoding('utf8');
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json);
                } catch (e) {
                    reject(e);
                }
            });
            res.on('error', reject);
        });
    });
}

// Manually define the nine-dash line coordinates (Approximate)
const NINE_DASH_LINE = [
    [[108.20, 20.90], [108.20, 19.50]], 
    [[109.50, 18.50], [110.50, 16.50]], 
    [[112.50, 15.50], [114.50, 13.50]], 
    [[115.50, 12.50], [117.50, 11.00]], 
    [[118.50, 10.50], [120.50, 10.00]], 
    [[120.50, 10.50], [121.50, 12.50]], 
    [[121.50, 14.50], [120.50, 16.50]], 
    [[119.50, 18.50], [119.50, 20.50]], 
    [[120.50, 22.50], [122.50, 24.50]], 
];

function cleanPath(path) {
    if (!path) return path;
    
    // Split into commands
    // This is a naive heuristic: if a subpath (M...Z) contains coordinates that are way out of bounds, drop it.
    // The "sphere" artifact usually appears as a separate subpath or a large loop.
    
    // Regex to find numbers
    const parts = path.split(/(?=[Mm])/); // Split by Move command
    
    return parts.filter(part => {
        const coords = part.match(/-?\d+\.?\d*/g);
        if (!coords) return true;
        
        // Check if any coordinate is way out of bounds
        // Canvas is 800x600.
        for (let i = 0; i < coords.length; i++) {
            const val = parseFloat(coords[i]);
            // Tighten the bounds to exclude artifacts (e.g. world bounds)
            // Relaxed bounds to ensure we don't drop valid parts like Taiwan/South China Sea islands
            if (val > 6000 || val < -4000) {
                console.warn(`Dropped path part due to bounds: ${val}`);
                return false; // Drop this part
            }
        }
        return true;
    }).join('');
}

async function generateMapFile() {
    try {
        console.log('Fetching map data...');
        const geoJson = await fetchMapData();
        
        console.log('Processing map data...');
        
        const projection = geoMercator()
            .center(PROJECTION_CONFIG.center)
            .scale(PROJECTION_CONFIG.scale)
            .translate(PROJECTION_CONFIG.translate);

        const pathGenerator = geoPath().projection(projection);

        const configs = [];
        
        geoJson.features.forEach(feature => {
            const name = feature.properties.name;
            console.log(`Found feature: ${name}`); // Debug log
            const id = NAME_TO_ID[name];
            
            if (id) {
                // Generate path
                let path = pathGenerator(feature);
                
                if (id === 'xinjiang-uygur') {
                    console.log(`Xinjiang raw path length: ${path ? path.length : 0}`);
                }

                // Clean path artifacts
                path = cleanPath(path);

                if (id === 'xinjiang-uygur') {
                    console.log(`Xinjiang cleaned path length: ${path ? path.length : 0}`);
                }

                configs.push({
                    id: id,
                    name: name.replace(/(省|市|自治区|特别行政区)$/, ''), // Simplified name
                    path: path
                });
            } else {
                console.warn(`Unknown province in GeoJSON: ${name}`);
            }
        });

        // Generate paths for Nine-Dash Line
        const nineDashPaths = NINE_DASH_LINE.map(coords => {
            const lineFeature = {
                type: "Feature",
                geometry: {
                    type: "LineString",
                    coordinates: coords
                }
            };
            return pathGenerator(lineFeature);
        });

        const fileContent = `import { ProvinceConfig } from '../types';

export const MAP_WIDTH = 800;
export const MAP_HEIGHT = 600;

export const PROVINCE_CONFIGS: ProvinceConfig[] = ${JSON.stringify(configs, null, 2)};

export const NINE_DASH_PATHS: string[] = ${JSON.stringify(nineDashPaths, null, 2)};
`;

        fs.writeFileSync(OUTPUT_FILE, fileContent);
        console.log(`Map data written to ${OUTPUT_FILE}`);

    } catch (error) {
        console.error('Error:', error);
    }
}

generateMapFile();
