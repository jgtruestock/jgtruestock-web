export default function Loading() {
  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 16px' }}>
      <div style={{ height: 24, background: '#eee', borderRadius: 4, marginBottom: 16, width: '30%', animation: 'pulse 1.5s infinite' }} />
      <div style={{ height: 60, background: '#eee', borderRadius: 8, marginBottom: 24 }} />
      <div style={{ height: 200, background: '#eee', borderRadius: 8, marginBottom: 16 }} />
      <div style={{ height: 16, background: '#eee', borderRadius: 4, marginBottom: 8, width: '80%' }} />
      <div style={{ height: 16, background: '#eee', borderRadius: 4, marginBottom: 8, width: '60%' }} />
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.5 } }`}</style>
    </div>
  );
}
