import Header from '../components/Header'
import packageJson from '../package.json'
import './globals.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>
        <Header version={packageJson.version} />
        <div className="app-main">{children}</div>
      </body>
    </html>
  );
}
