import { MapCanvas } from './components/MapCanvas';

export default function App() {

  return (
    <main className="w-full h-screen overflow-hidden bg-slate-100">
      <MapCanvas />
      <div className="fixed bottom-3 right-4 text-[10px] text-gray-400 bg-white/70 px-3 py-1 rounded-full shadow-sm select-none">
        <span id="busuanzi_container_page_pv">
          你是第 <span id="busuanzi_value_page_pv"></span> 位留痕的旅行者
        </span>
      </div>
    </main>
  );
}
