import Header from '../components/Header'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body style={{ margin: 0, fontFamily: 'sans-serif' }}>
        <Header />
        {children}
      </body>
    </html>
  );
}
