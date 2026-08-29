import { HashRouter, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import PatchNotes from './pages/PatchNotes';
import PatchNoteDetail from './pages/PatchNoteDetail';
import CharacterStatus from './pages/CharacterStatus';
import ModeSelect from './pages/ModeSelect';
import BanPick from './pages/BanPick';
import Battle from './pages/Battle';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/patch-notes" element={<PatchNotes />} />
        <Route path="/patch-notes/:id" element={<PatchNoteDetail />} />
        <Route path="/status" element={<CharacterStatus />} />
        <Route path="/mode-select" element={<ModeSelect />} />
        <Route path="/ban-pick" element={<BanPick />} />
        <Route path="/battle" element={<Battle />} />
      </Routes>
    </HashRouter>
  );
}
