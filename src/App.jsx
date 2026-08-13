import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, onValue, set } from 'firebase/database';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './App.css';

const firebaseConfig = {
  databaseURL: "https://recolectahumanitaria-app-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export default function App() {
  const [familias, setFamilias] = useState([]);
  const [donaciones, setDonaciones] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    const familiasRef = ref(db, 'familias');
    const donacionesRef = ref(db, 'donaciones');
    const gastosRef = ref(db, 'gastos');

    onValue(familiasRef, (snapshot) => {
      const data = snapshot.val();
      setFamilias(data ? Object.entries(data).map(([id, val]) => ({ id, ...val })) : []);
    });

    onValue(donacionesRef, (snapshot) => {
      const data = snapshot.val();
      setDonaciones(data ? Object.entries(data).map(([id, val]) => ({ id, ...val })) : []);
    });

    onValue(gastosRef, (snapshot) => {
      const data = snapshot.val();
      setGastos(data ? Object.entries(data).map(([id, val]) => ({ id, ...val })) : []);
    });
  }, []);

  const totalRecogido = donaciones.reduce((sum, d) => sum + (d.monto || 0), 0);
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
        <h1>Recolecta Humanitaria 🤝</h1>
        <p>Chocó y Pereira</p>
      </header>

      <nav className="nav">
        <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>Dashboard</button>
        <button className={activeTab === 'familias' ? 'active' : ''} onClick={() => setActiveTab('familias')}>Familias</button>
        <button className={activeTab === 'donacion' ? 'active' : ''} onClick={() => setActiveTab('donacion')}>Registrar Donación</button>
        <button className={activeTab === 'familia' ? 'active' : ''} onClick={() => setActiveTab('familia')}>Registrar Familia</button>
        <button className={activeTab === 'gasto' ? 'active' : ''} onClick={() => setActiveTab('gasto')}>Registrar Gasto</button>
        <button className={activeTab === 'gastos' ? 'active' : ''} onClick={() => setActiveTab('gastos')}>Ver Gastos</button>
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
            donaciones={donaciones}
            gastos={gastos}
          />
        )}

        {activeTab === 'familia' && <FormFamilia />}
        {activeTab === 'donacion' && <FormDonacion />}
        {activeTab === 'gasto' && <FormGasto />}
        {activeTab === 'familias' && <ListaFamilias familias={familias} />}
        {activeTab === 'gastos' && <ListaGastos gastos={gastos} />}
      </main>
    </div>
  );
}

function Dashboard({ totalRecogido, totalGastado, disponible, numFamilias, familiaEntregadas, gastoPorCategoria, donaciones, gastos }) {
  return (
    <div className="dashboard">
      <div className="cards">
        <Card label="Dinero Recogido" value={`$${totalRecogido.toLocaleString('es-CO')}`} color="green" />
        <Card label="Dinero Gastado" value={`$${totalGastado.toLocaleString('es-CO')}`} color="red" />
        <Card label="Disponible" value={`$${disponible.toLocaleString('es-CO')}`} color="blue" />
        <Card label="Familias" value={numFamilias} color="purple" />
        <Card label="Entregadas" value={`${familiaEntregadas}/${numFamilias}`} color="teal" />
      </div>

      {gastoPorCategoria.length > 0 && (
        <div className="chart-container">
          <h2>Gastos por Categoría</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={gastoPorCategoria}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => `$${value.toLocaleString('es-CO')}`} />
              <Bar dataKey="value" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {donaciones.length > 0 && (
        <div className="recent-section">
          <h2>Últimas Donaciones</h2>
          <div className="list">
            {donaciones.slice(-5).reverse().map(d => (
              <div key={d.id} className="item">
                <span>${d.monto.toLocaleString('es-CO')} COP</span>
                <span className="muted">{d.quienDono || 'Anónimo'} • {new Date(d.fecha).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {gastos.length > 0 && (
        <div className="recent-section">
          <h2>Últimas Compras</h2>
          <div className="list">
            {gastos.slice(-5).reverse().map(g => (
              <div key={g.id} className="item">
                <span>${g.monto.toLocaleString('es-CO')} • {g.queSe}</span>
                <span className="muted">{g.categoria} • {new Date(g.fecha).toLocaleDateString()}</span>
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

function FormFamilia() {
  const [form, setForm] = useState({ nombre: '', personas: '', necesidades: [], contacto: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) {
      alert('Nombre es requerido');
      return;
    }
    push(ref(db, 'familias'), {
      nombre: form.nombre,
      personas: parseInt(form.personas) || 0,
      necesidades: form.necesidades,
      contacto: form.contacto,
      fecha: new Date().toISOString(),
      entregado: false
    });
    setForm({ nombre: '', personas: '', necesidades: [], contacto: '' });
    alert('Familia registrada');
  };

  const handleCheck = (cat) => {
    setForm({
      ...form,
      necesidades: form.necesidades.includes(cat)
        ? form.necesidades.filter(x => x !== cat)
        : [...form.necesidades, cat]
    });
  };

  return (
    <form onSubmit={handleSubmit} className="form">
      <h2>Registrar Familia</h2>
      <input type="text" placeholder="Nombre familia" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
      <input type="number" placeholder="# de personas" value={form.personas} onChange={(e) => setForm({ ...form, personas: e.target.value })} />
      <input type="text" placeholder="Contacto responsable" value={form.contacto} onChange={(e) => setForm({ ...form, contacto: e.target.value })} />
      <fieldset>
        <legend>Necesidades</legend>
        {['Aseo', 'Alimento', 'Construcción', 'Bebés', 'Salud'].map(cat => (
          <label key={cat}>
            <input type="checkbox" checked={form.necesidades.includes(cat)} onChange={() => handleCheck(cat)} />
            {cat}
          </label>
        ))}
      </fieldset>
      <button type="submit">Guardar Familia</button>
    </form>
  );
}

function FormDonacion() {
  const [form, setForm] = useState({ monto: '', quienDono: '', nota: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.monto || parseInt(form.monto) <= 0) {
      alert('Monto debe ser mayor a 0');
      return;
    }
    push(ref(db, 'donaciones'), {
      monto: parseInt(form.monto),
      quienDono: form.quienDono,
      nota: form.nota,
      fecha: new Date().toISOString()
    });
    setForm({ monto: '', quienDono: '', nota: '' });
    alert('Donación registrada');
  };

  return (
    <form onSubmit={handleSubmit} className="form">
      <h2>Registrar Donación</h2>
      <input type="number" placeholder="Monto (COP)" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} required />
      <input type="text" placeholder="¿Quién donó? (opcional)" value={form.quienDono} onChange={(e) => setForm({ ...form, quienDono: e.target.value })} />
      <textarea placeholder="Nota (opcional)" value={form.nota} onChange={(e) => setForm({ ...form, nota: e.target.value })} />
      <button type="submit">Registrar Donación</button>
    </form>
  );
}

function FormGasto() {
  const [form, setForm] = useState({ categoria: 'Aseo', monto: '', queSe: '', quienCompro: '', factura: '' });

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
    if (!form.monto || parseInt(form.monto) <= 0) {
      alert('Monto debe ser mayor a 0');
      return;
    }
    push(ref(db, 'gastos'), {
      categoria: form.categoria,
      monto: parseInt(form.monto),
      queSe: form.queSe,
      quienCompro: form.quienCompro,
      factura: form.factura || null,
      fecha: new Date().toISOString()
    });
    setForm({ categoria: 'Aseo', monto: '', queSe: '', quienCompro: '', factura: '' });
    alert('Gasto registrado');
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
      <input type="number" placeholder="Monto (COP)" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} required />
      <input type="text" placeholder="¿Qué se compró?" value={form.queSe} onChange={(e) => setForm({ ...form, queSe: e.target.value })} />
      <input type="text" placeholder="¿Quién compró? (opcional)" value={form.quienCompro} onChange={(e) => setForm({ ...form, quienCompro: e.target.value })} />
      <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileUpload} />
      {form.factura && <p className="muted">Factura adjunta ✓</p>}
      <button type="submit">Registrar Gasto</button>
    </form>
  );
}

function ListaFamilias({ familias }) {
  const marcarEntregado = (id, entregado) => {
    set(ref(db, `familias/${id}/entregado`), !entregado);
  };

  return (
    <div className="lista">
      <h2>Familias ({familias.length})</h2>
      {familias.length === 0 ? (
        <p className="muted">No hay familias registradas</p>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Personas</th>
                <th>Necesidades</th>
                <th>Contacto</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {familias.map(f => (
                <tr key={f.id}>
                  <td>{f.nombre}</td>
                  <td>{f.personas}</td>
                  <td>{f.necesidades?.join(', ') || '-'}</td>
                  <td>{f.contacto || '-'}</td>
                  <td>
                    <button className={`btn-estado ${f.entregado ? 'entregado' : 'pendiente'}`} onClick={() => marcarEntregado(f.id, f.entregado)}>
                      {f.entregado ? 'Entregado' : 'Pendiente'}
                    </button>
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
                  <td>${g.monto.toLocaleString('es-CO')}</td>
                  <td>{g.queSe}</td>
                  <td>{g.quienCompro || '-'}</td>
                  <td>{new Date(g.fecha).toLocaleDateString()}</td>
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