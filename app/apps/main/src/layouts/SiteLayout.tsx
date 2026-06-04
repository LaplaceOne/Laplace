import { Outlet } from 'react-router-dom';
import { AmbientBackground, CursorRing } from '@laplace-one/ui';
import { Nav } from '../components/Nav';
import { Footer } from '../components/Footer';

export function SiteLayout() {
  return (
    <>
      <AmbientBackground />
      <CursorRing />
      <Nav />
      <main><Outlet /></main>
      <Footer />
    </>
  );
}
