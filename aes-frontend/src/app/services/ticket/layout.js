import { ServiceProvider } from '@/store/serviceStore';

export default function ServiceTicketLayout({ children }) {
  return <ServiceProvider>{children}</ServiceProvider>;
}
