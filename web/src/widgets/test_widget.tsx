import "@/index.css";
export default function TestWidget() {
  return (
    <div style={{ padding: "20px", background: "#f0f0f0", borderRadius: "8px" }}>
      <h1>Test Widget</h1>
      <p>If you can see this, widgets are rendering!</p>
    </div>
  );
}

mountWidget(<TestWidget />);
