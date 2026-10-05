import type { RoomQuality, RoomTime } from './RoomScene3D';
export const roomLighting = {
  day: { sky: '#b8cde1', sun: '#fff3df', power: 3, ambient: .75, practical: 18 },
  sunset: { sky: '#c3919c', sun: '#ffb575', power: 2.5, ambient: .5, practical: 28 },
  night: { sky: '#101c36', sun: '#8aaaf5', power: .35, ambient: .25, practical: 38 },
};
export default function RoomLighting({ time, quality }: { time: RoomTime; quality: RoomQuality }) {
  const l = roomLighting[time];
  return <group>
    <hemisphereLight args={[l.sky, '#514436', l.ambient]} />
    <directionalLight position={[-4, 6, -8]} color={l.sun} intensity={l.power} castShadow={quality !== 'low'} shadow-mapSize={quality === 'high' ? [2048, 2048] : [1024, 1024]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-8} shadow-bias={-.0003} shadow-normalBias={.025} />
    <pointLight position={[-3, 4.5, 1]} color="#ffd0a0" intensity={l.practical} distance={14} decay={2} />
    <pointLight position={[3, 4.5, -1]} color="#ffcf98" intensity={l.practical} distance={14} decay={2} />
    <pointLight position={[4, 2, 2]} color="#8bd7ff" intensity={time === 'night' ? 7 : 3} distance={9} decay={2} />
  </group>;
}
