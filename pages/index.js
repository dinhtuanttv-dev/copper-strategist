export default function Home() {
  return (
    <div style={{
      background: '#080c14',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: '12px'
    }}>
      <h1 style={{ color: '#06b6d4', fontFamily: 'monospace', fontSize: '24px' }}>
        ⚡ Copper Strategist v3.0
      </h1>
      <p style={{ color: '#5a7090', fontFamily: 'monospace', fontSize: '12px' }}>
        Đang khởi động...
      </p>
    </div>
  );
}