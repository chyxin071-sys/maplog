
import chinaMap from '@svg-maps/china';
console.log(JSON.stringify(chinaMap.locations.map(l => ({id: l.id, name: l.name}))));
