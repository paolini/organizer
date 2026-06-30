import Header from '../components/Header'
import packageJson from '../package.json'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body style={{ margin: 0, fontFamily: 'sans-serif' }}>
        <Header version={packageJson.version} />
        {children}
      </body>
    </html>
  );
}
