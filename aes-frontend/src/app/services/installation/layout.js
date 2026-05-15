import { InstallationProvider } from '@/store/installationStore';

export default function InstallationLayout({ children }) {
  return <InstallationProvider>{children}</InstallationProvider>;
}
