import React, { useState, useEffect, useCallback, useContext, createContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, onValue, set } from 'firebase/database';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './App.css';

const firebaseConfig = {
  databaseURL: "https://recolectahumanitaria-app-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* ---------- Formato de moneda ---------- */

const formatoCOP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

// Versión corta para ejes de gráficos, donde el monto completo no cabe
const formatoCOPCorto = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  notation: 'compact',
  maximumFractionDigits: 1
});

const formatCOP = (monto) => formatoCOP.format(monto || 0);
const formatCOPCorto = (monto) => formatoCOPCorto.format(monto || 0);

/* ---------- Toast reutilizable ---------- */

const ToastContext = createContext(() => {});
const useToast = () => useContext(ToastContext);

function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const mostrarToast = useCallback((mensaje) => {
    setToast({ id: Date.now(), mensaje });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(id);
  }, [toast]);

  return (
    <ToastContext.Provider value={mostrarToast}>
      {children}
      {/* key fuerza reiniciar la animación si sale un toast tras otro */}
      {toast && <div key={toast.id} className="toast" role="status">{toast.mensaje}</div>}
    </ToastContext.Provider>
  );
}

/* ---------- Utilidades ---------- */

function useEsMobile() {
  const [esMobile, setEsMobile] = useState(() => window.matchMedia('(max-width: 768px)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e) => setEsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return esMobile;
}

function tiempoTranscurrido(fecha) {
  const minutos = Math.floor((Date.now() - new Date(fecha).getTime()) / 60000);
  if (minutos < 1) return 'hace un momento';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

function formatoHora(fecha) {
  return new Date(fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatoDiaMes(fecha) {
  const d = new Date(fecha);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/* ---------- App ---------- */

export default function App() {
  return (
    <ToastProvider>
      <AppContenido />
    </ToastProvider>
  );
}

function AppContenido() {
  const [familias, setFamilias] = useState([]);
  const [actualizaciones, setActualizaciones] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    const familiasRef = ref(db, 'familias');
    const actualizacionesRef = ref(db, 'actualizaciones');
    const gastosRef = ref(db, 'gastos');

    onValue(familiasRef, (snapshot) => {
      const data = snapshot.val();
      setFamilias(data ? Object.entries(data).map(([id, val]) => ({ id, ...val })) : []);
    });

    onValue(actualizacionesRef, (snapshot) => {
      const data = snapshot.val();
      setActualizaciones(data ? Object.entries(data).map(([id, val]) => ({ id, ...val })) : []);
    });

    onValue(gastosRef, (snapshot) => {
      const data = snapshot.val();
      setGastos(data ? Object.entries(data).map(([id, val]) => ({ id, ...val })) : []);
    });
  }, []);

  // Ordenadas de más antigua a más reciente por fecha
  const actualizacionesOrdenadas = [...actualizaciones].sort(
    (a, b) => new Date(a.fecha) - new Date(b.fecha)
  );
  const ultimaActualizacion = actualizacionesOrdenadas[actualizacionesOrdenadas.length - 1] || null;

  // El total es el monto de la actualización más reciente (no suma ni máximo)
  const totalRecogido = ultimaActualizacion?.monto || 0;
  const totalGastado = gastos.reduce((sum, g) => sum + (g.monto || 0), 0);
  const disponible = totalRecogido - totalGastado;

  const gastoPorCategoria = gastos.reduce((acc, gasto) => {
    const cat = gasto.categoria || 'Sin categoría';
    const idx = acc.findIndex(x => x.name === cat);
    if (idx >= 0) {
      acc[idx].value += gasto.monto;
    } else {
      acc.push({ name: cat, value: gasto.monto });
    }
    return acc;
  }, []);

  const familiaEntregadas = familias.filter(f => f.entregado).length;

  return (
    <div className="app">
      <header className="header">
        <h1>Recolecta Humanitaria Grupo Manga 🤝</h1>
      </header>

      <nav className="nav">
        <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>Dashboard</button>
        <button className={activeTab === 'actualizar' ? 'active' : ''} onClick={() => setActiveTab('actualizar')}>Actualizar Total</button>
        <button className={activeTab === 'familias' ? 'active' : ''} onClick={() => setActiveTab('familias')}>Familias</button>
        <button className={activeTab === 'gastos' ? 'active' : ''} onClick={() => setActiveTab('gastos')}>Gastos</button>
      </nav>

      <main className="content">
        {activeTab === 'dashboard' && (
          <Dashboard
            totalRecogido={totalRecogido}
            totalGastado={totalGastado}
            disponible={disponible}
            numFamilias={familias.length}
            familiaEntregadas={familiaEntregadas}
            gastoPorCategoria={gastoPorCategoria}
            actualizaciones={actualizacionesOrdenadas}
            ultimaActualizacion={ultimaActualizacion}
            gastos={gastos}
          />
        )}

        {activeTab === 'actualizar' && <FormActualizarTotal />}
        {activeTab === 'familias' && <PaginaFamilias familias={familias} />}
        {activeTab === 'gastos' && <PaginaGastos gastos={gastos} />}
      </main>
    </div>
  );
}

/* ---------- Dashboard ---------- */

function Dashboard({ totalRecogido, totalGastado, disponible, numFamilias, familiaEntregadas, gastoPorCategoria, actualizaciones, ultimaActualizacion, gastos }) {
  const esMobile = useEsMobile();

  // Refresca el "hace X min" cada minuto sin depender de nuevos datos
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const datosGrafico = actualizaciones.map(a => ({
    hora: formatoHora(a.fecha),
    monto: a.monto
  }));

  const alturaGrafico = esMobile ? 220 : 300;

  return (
    <div className="dashboard">
      <div className="cards">
        <Card label="Dinero Recogido" value={formatCOP(totalRecogido)} color="green" />
        <Card label="Dinero Gastado" value={formatCOP(totalGastado)} color="red" />
        <Card label="Disponible" value={formatCOP(disponible)} color="blue" />
        <Card label="Familias" value={numFamilias} color="purple" />
        <Card label="Entregadas" value={`${familiaEntregadas}/${numFamilias}`} color="teal" />
      </div>

      {ultimaActualizacion && (
        <p className="ultima-actualizacion">
          Actualizado {tiempoTranscurrido(ultimaActualizacion.fecha)}
        </p>
      )}

      <div className="chart-container">
        <h2>Evolución de la Recolecta</h2>
        {datosGrafico.length < 2 ? (
          <p className="muted">Aún no hay suficientes datos</p>
        ) : (
          <ResponsiveContainer width="100%" height={alturaGrafico}>
            <LineChart data={datosGrafico} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis
                dataKey="hora"
                tick={{ fontSize: 12, fill: '#999' }}
                tickLine={false}
                axisLine={{ stroke: '#e0e0e0' }}
                interval="preserveStartEnd"
                minTickGap={esMobile ? 28 : 12}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#999' }}
                tickLine={false}
                axisLine={false}
                width={esMobile ? 52 : 72}
                tickFormatter={formatCOPCorto}
              />
              <Tooltip
                formatter={(value) => [formatCOP(value), 'Total']}
                labelFormatter={(label) => `Hora: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="monto"
                stroke="#667eea"
                strokeWidth={2}
                dot={{ r: 4, fill: '#667eea', strokeWidth: 0 }}
                activeDot={{ r: 6, fill: '#667eea', stroke: '#fff', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {actualizaciones.length > 0 && (
        <div className="recent-section">
          <h2>Historial de Actualizaciones</h2>
          <div className="list historial">
            {[...actualizaciones].reverse().map(a => (
              <div key={a.id} className="item">
                <span>{formatCOP(a.monto)}</span>
                <span className="muted">{formatoDiaMes(a.fecha)} · {formatoHora(a.fecha)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {gastoPorCategoria.length > 0 && (
        <div className="chart-container">
          <h2>Gastos por Categoría</h2>
          <ResponsiveContainer width="100%" height={alturaGrafico}>
            <BarChart data={gastoPorCategoria} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              {/* En mobile las categorías se inclinan para que quepan las 5 sin encimarse */}
              <XAxis
                dataKey="name"
                tick={{ fontSize: esMobile ? 10 : 12, fill: '#999' }}
                tickLine={false}
                axisLine={{ stroke: '#e0e0e0' }}
                interval={0}
                angle={esMobile ? -35 : 0}
                textAnchor={esMobile ? 'end' : 'middle'}
                height={esMobile ? 60 : 30}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#999' }}
                tickLine={false}
                axisLine={false}
                width={esMobile ? 52 : 72}
                tickFormatter={formatCOPCorto}
              />
              <Tooltip formatter={(value) => [formatCOP(value), 'Gastado']} />
              <Bar dataKey="value" fill="#667eea" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {gastos.length > 0 && (
        <div className="recent-section">
          <h2>Últimas Compras</h2>
          <div className="list">
            {gastos.slice(-5).reverse().map(g => (
              <div key={g.id} className="item">
                <span>{formatCOP(g.monto)} • {g.queSe}</span>
                <span className="muted">{g.categoria} • {new Date(g.fecha).toLocaleDateString('es-CO')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ label, value, color }) {
  return (
    <div className={`card card-${color}`}>
      <p className="card-label">{label}</p>
      <p className="card-value">{value}</p>
    </div>
  );
}

/* ---------- Input de monto formateado ---------- */

// Guarda solo dígitos, muestra el valor formateado en COP mientras se escribe
function InputMonto({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder={placeholder}
      value={value ? formatCOP(parseInt(value, 10)) : ''}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
      required
    />
  );
}

/* ---------- Actualizar Total ---------- */

function FormActualizarTotal() {
  const [monto, setMonto] = useState('');
  const mostrarToast = useToast();

  const handleSubmit = (e) => {
    e.preventDefault();
    const valor = parseInt(monto, 10);
    if (!monto || isNaN(valor) || valor <= 0) {
      mostrarToast('Ingresa un total mayor a 0');
      return;
    }
    // Sin validar contra el total anterior: se permite corregir errores hacia abajo
    push(ref(db, 'actualizaciones'), {
      monto: valor,
      fecha: new Date().toISOString()
    });
    setMonto('');
    mostrarToast('Total actualizado');
  };

  return (
    <form onSubmit={handleSubmit} className="form">
      <h2>Actualizar Total</h2>
      <InputMonto value={monto} onChange={setMonto} placeholder="Total acumulado (COP)" />
      <button type="submit">Actualizar Total</button>
    </form>
  );
}

/* ---------- Familias (form + lista) ---------- */

function PaginaFamilias({ familias }) {
  return (
    <div className="pagina">
      <FormFamilia />
      <ListaFamilias familias={familias} />
    </div>
  );
}

function FormFamilia() {
  const [form, setForm] = useState({ nombre: '', personas: '', contacto: '' });
  const mostrarToast = useToast();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) {
      mostrarToast('Nombre es requerido');
      return;
    }
    push(ref(db, 'familias'), {
      nombre: form.nombre,
      personas: parseInt(form.personas, 10) || 0,
      contacto: form.contacto,
      fecha: new Date().toISOString(),
      entregado: false
    });
    setForm({ nombre: '', personas: '', contacto: '' });
    mostrarToast('Familia registrada');
  };

  return (
    <form onSubmit={handleSubmit} className="form">
      <h2>Registrar Familia</h2>
      <input type="text" placeholder="Nombre familia" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
      <input type="number" inputMode="numeric" placeholder="# de personas" value={form.personas} onChange={(e) => setForm({ ...form, personas: e.target.value })} />
      <input type="text" placeholder="Contacto responsable" value={form.contacto} onChange={(e) => setForm({ ...form, contacto: e.target.value })} />
      <button type="submit">Guardar Familia</button>
    </form>
  );
}

function ListaFamilias({ familias }) {
  const [busqueda, setBusqueda] = useState('');
  const [expandida, setExpandida] = useState(null);
  const mostrarToast = useToast();

  const marcarEntregado = (id, entregado) => {
    set(ref(db, `familias/${id}/entregado`), !entregado);
    mostrarToast(entregado ? 'Marcada pendiente' : 'Marcada entregada');
  };

  const filtradas = familias.filter(f =>
    (f.nombre || '').toLowerCase().includes(busqueda.trim().toLowerCase())
  );

  return (
    <div className="lista">
      <h2>Familias ({familias.length})</h2>

      <input
        type="text"
        className="buscador"
        placeholder="Buscar familia por nombre..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      {familias.length === 0 ? (
        <p className="muted">No hay familias registradas</p>
      ) : filtradas.length === 0 ? (
        <p className="muted">Ninguna familia coincide con "{busqueda}"</p>
      ) : (
        <div className="familias-cards">
          {filtradas.map(f => {
            const abierta = expandida === f.id;
            return (
              <div key={f.id} className={`familia-card ${abierta ? 'abierta' : ''}`}>
                <button
                  className="familia-header"
                  onClick={() => setExpandida(abierta ? null : f.id)}
                  aria-expanded={abierta}
                >
                  <span className={`chevron ${abierta ? 'rotado' : ''}`}>▶</span>
                  <span className="familia-nombre">{f.nombre}</span>
                  <span className={`badge ${f.entregado ? 'entregado' : 'pendiente'}`}>
                    {f.entregado ? 'Entregado' : 'Pendiente'}
                  </span>
                </button>

                {abierta && (
                  <div className="familia-detalle">
                    <p><strong># Personas:</strong> {f.personas || '-'}</p>
                    <p><strong>Contacto:</strong> {f.contacto || '-'}</p>
                    <button
                      className={`btn-estado ${f.entregado ? 'entregado' : 'pendiente'}`}
                      onClick={() => marcarEntregado(f.id, f.entregado)}
                    >
                      {f.entregado ? 'Marcar Pendiente' : 'Marcar Entregado'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Gastos (form + tabla) ---------- */

function PaginaGastos({ gastos }) {
  return (
    <div className="pagina">
      <FormGasto />
      <ListaGastos gastos={gastos} />
    </div>
  );
}

function FormGasto() {
  const [form, setForm] = useState({ categoria: 'Aseo', monto: '', queSe: '', quienCompro: '', factura: '' });
  const mostrarToast = useToast();

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setForm({ ...form, factura: event.target.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const valor = parseInt(form.monto, 10);
    if (!form.monto || isNaN(valor) || valor <= 0) {
      mostrarToast('El monto debe ser mayor a 0');
      return;
    }
    push(ref(db, 'gastos'), {
      categoria: form.categoria,
      monto: valor,
      queSe: form.queSe,
      quienCompro: form.quienCompro,
      factura: form.factura || null,
      fecha: new Date().toISOString()
    });
    setForm({ categoria: 'Aseo', monto: '', queSe: '', quienCompro: '', factura: '' });
    mostrarToast('Gasto registrado');
  };

  return (
    <form onSubmit={handleSubmit} className="form">
      <h2>Registrar Gasto</h2>
      <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
        <option>Aseo</option>
        <option>Alimento</option>
        <option>Construcción</option>
        <option>Bebés</option>
        <option>Salud</option>
      </select>
      <InputMonto value={form.monto} onChange={(monto) => setForm({ ...form, monto })} placeholder="Monto (COP)" />
      <input type="text" placeholder="¿Qué se compró?" value={form.queSe} onChange={(e) => setForm({ ...form, queSe: e.target.value })} />
      <input type="text" placeholder="¿Quién compró? (opcional)" value={form.quienCompro} onChange={(e) => setForm({ ...form, quienCompro: e.target.value })} />
      <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileUpload} />
      {form.factura && <p className="muted">Factura adjunta ✓</p>}
      <button type="submit">Registrar Gasto</button>
    </form>
  );
}

function ListaGastos({ gastos }) {
  const descargarFactura = (factura) => {
    const link = document.createElement('a');
    link.href = factura;
    link.download = 'factura.pdf';
    link.click();
  };

  return (
    <div className="lista">
      <h2>Gastos ({gastos.length})</h2>
      {gastos.length === 0 ? (
        <p className="muted">No hay gastos registrados</p>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Monto</th>
                <th>Descripción</th>
                <th>Quién</th>
                <th>Fecha</th>
                <th>Factura</th>
              </tr>
            </thead>
            <tbody>
              {gastos.map(g => (
                <tr key={g.id}>
                  <td>{g.categoria}</td>
                  <td>{formatCOP(g.monto)}</td>
                  <td>{g.queSe}</td>
                  <td>{g.quienCompro || '-'}</td>
                  <td>{new Date(g.fecha).toLocaleDateString('es-CO')}</td>
                  <td>
                    {g.factura ? (
                      <button className="link" onClick={() => descargarFactura(g.factura)}>
                        Descargar
                      </button>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
