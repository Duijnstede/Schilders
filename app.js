// 1. Importeer de benodigde Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, where, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ------------------------------------------------------------------------
// PLAK JOUW GEKOPIEERDE FIREBASE CONFIG HIERONDER
const firebaseConfig = {
  apiKey: "AIzaSyC0eTtQOX50MqEHo5D0B5-yBPiAfrX3Lyk",
  authDomain: "urenregistratie-schilders.firebaseapp.com",
  projectId: "urenregistratie-schilders",
  storageBucket: "urenregistratie-schilders.firebasestorage.app",
  messagingSenderId: "885772883499",
  appId: "1:885772883499:web:bb21bcbf9854ff8cdc3c6e"
};
// ------------------------------------------------------------------------
// Initialiseer Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let urenData = [];
let editingId = null;

// --- BEVEILIGINGS FILTERS ---
function sanitizeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
}

function sanitizeCSV(str) {
    if (!str) return '';
    if (str.match(/^[=\+\-@\t\r\n]/)) {
        return "'" + str; 
    }
    return str;
}
// ----------------------------

// Datum weergave instellen
document.getElementById('current-date-display').innerText = new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });

// "Andere" logica radiobuttons
document.querySelectorAll('input[name="omschrijving"]').forEach(radio => {
    radio.addEventListener('change', function() {
        const andereInput = document.getElementById('andere-tekst');
        if(this.id === 'radio-andere') {
            andereInput.classList.remove('hidden'); andereInput.required = true;
        } else {
            andereInput.classList.add('hidden'); andereInput.required = false;
        }
    });
});

// CHECK OF IEMAND IS INGELOGD
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-screen').classList.remove('hidden');
        document.getElementById('user-display').innerText = sanitizeHTML(user.email.split('@')[0]);
        haalUrenOp(); 
    } else {
        currentUser = null;
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('app-screen').classList.add('hidden');
    }
});

// LOGIN FUNCTIE
window.login = async function() {
    const email = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
        alert("Fout bij inloggen: Controleer e-mailadres en wachtwoord.");
    }
}

// UITLOGGEN
window.logout = function() {
    signOut(auth);
}

// TABS WISSELEN
window.showTab = function(tabId) {
    document.getElementById('form-tab').classList.add('hidden');
    document.getElementById('overview-tab').classList.add('hidden');
    document.getElementById(tabId).classList.remove('hidden');
    
    document.getElementById('tab-btn-form').classList.remove('active');
    document.getElementById('tab-btn-overview').classList.remove('active');
    
    if(tabId === 'form-tab') document.getElementById('tab-btn-form').classList.add('active');
    if(tabId === 'overview-tab') document.getElementById('tab-btn-overview').classList.add('active');
}

// IN- EN UITKLAPPEN VAN WEKEN
window.toggleWeek = function(weekKey) {
    const content = document.getElementById(`content-${weekKey}`);
    const icon = document.getElementById(`icon-${weekKey}`);
    
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        icon.style.transform = "rotate(0deg)"; // Pijltje omlaag
    } else {
        content.classList.add('hidden');
        icon.style.transform = "rotate(-90deg)"; // Pijltje opzij
    }
}

// CONTROLEER WEEKEND
window.checkDatum = function() {
    const datumVal = document.getElementById('datum').value;
    if (!datumVal) return;
    const day = new Date(datumVal).getDay();
    if (day === 0 || day === 6) {
        document.getElementById('datum-error').classList.remove('hidden');
        document.getElementById('submit-btn').disabled = true;
    } else {
        document.getElementById('datum-error').classList.add('hidden');
        window.checkUren(); 
    }
}

// CONTROLEER MAX 8 UUR
window.checkUren = function() {
    const datum = document.getElementById('datum').value;
    const nieuweUren = parseFloat(document.getElementById('uren').value) || 0;
    if (!datum) return;

    const urenOpDatum = urenData
        .filter(item => item.datum === datum && item.id !== editingId)
        .reduce((totaal, item) => totaal + parseFloat(item.uren), 0);

    if (urenOpDatum + nieuweUren > 8) {
        document.getElementById('uren-error').classList.remove('hidden');
        document.getElementById('submit-btn').disabled = true;
    } else {
        document.getElementById('uren-error').classList.add('hidden');
        document.getElementById('submit-btn').disabled = false;
    }
}

// DATABASE: UREN OPHALEN
async function haalUrenOp() {
    if (!currentUser) return;
    urenData = [];
    const q = query(collection(db, "uren"), where("userId", "==", currentUser.uid));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
        urenData.push({ id: doc.id, ...doc.data() });
    });
    renderLijst();
}

// FORMULIER VERZENDEN NAAR DATABASE
document.getElementById('uren-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    document.getElementById('submit-btn').disabled = true; 
    document.getElementById('submit-btn').innerText = "Opslaan...";
    
    const datumVal = document.getElementById('datum').value;
    const dateObj = new Date(datumVal);
    if (dateObj.getDay() === 0 || dateObj.getDay() === 6) {
        alert("Weekenduren worden niet geaccepteerd.");
        document.getElementById('submit-btn').disabled = false;
        document.getElementById('submit-btn').innerText = "Opslaan";
        return; 
    }

    let omschrijving = document.querySelector('input[name="omschrijving"]:checked').value;
    if (omschrijving === 'Andere') omschrijving = document.getElementById('andere-tekst').value;

    const invoerData = {
        userId: currentUser.uid,
        userEmail: currentUser.email,
        datum: datumVal,
        uren: document.getElementById('uren').value,
        adres: document.getElementById('adres').value, 
        omschrijving: omschrijving, 
        timestamp: Date.now()
    };

    try {
        if (editingId) {
            await updateDoc(doc(db, "uren", editingId), invoerData);
            alert("Uren succesvol bijgewerkt!");
        } else {
            await addDoc(collection(db, "uren"), invoerData);
            alert("Uren succesvol opgeslagen!");
        }
        await haalUrenOp(); 
        window.cancelEdit(); 
        window.showTab('overview-tab');
    } catch (error) {
        console.error("Fout bij opslaan:", error);
        alert("Er ging iets mis bij het opslaan.");
    }
    
    document.getElementById('submit-btn').disabled = false;
    document.getElementById('submit-btn').innerText = "Opslaan";
});

// HELPER: ISO WEEK NUMMER
function getWeekInfo(dateString) {
    const d = new Date(dateString);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    return { year: d.getFullYear(), week: weekNum };
}

const dagenNamen = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];

// LIJST TONEN (NU MET INKLAPFUNCTIE)
function renderLijst() {
    const lijst = document.getElementById('uren-lijst');
    lijst.innerHTML = '';
    
    if(urenData.length === 0) {
        lijst.innerHTML = '<div class="card"><p>Nog geen uren geregistreerd.</p></div>'; return;
    }

    const grouped = {};
    urenData.forEach(item => {
        const weekInfo = getWeekInfo(item.datum);
        const key = `${weekInfo.year}-W${weekInfo.week.toString().padStart(2, '0')}`;
        if(!grouped[key]) grouped[key] = { items: [], totals: { 1:0, 2:0, 3:0, 4:0, 5:0 } };
        grouped[key].items.push(item);
        
        const dayOfWeek = new Date(item.datum).getDay();
        if(dayOfWeek >= 1 && dayOfWeek <= 5) {
            grouped[key].totals[dayOfWeek] += parseFloat(item.uren);
        }
    });

    Object.keys(grouped).sort().reverse().forEach((key, index) => {
        const weekNum = key.split('-W')[1];
        const group = grouped[key];
        
        group.items.sort((a, b) => new Date(a.datum) - new Date(b.datum));
        
        const weekDiv = document.createElement('div');
        weekDiv.className = 'week-container';
        
        let totalsHTML = '';
        for(let i = 1; i <= 5; i++) {
            if(group.totals[i] > 0) totalsHTML += `<span class="day-stat">${dagenNamen[i]}: ${group.totals[i]}u</span>`;
        }

        // Bepaal of deze map dichtgeklapt moet zijn (we houden alleen de allernieuwste week open, de rest dicht)
        const isHidden = index === 0 ? '' : 'hidden';
        const rotation = index === 0 ? '0deg' : '-90deg';

        // Blauwe header is nu klikbaar (cursor: pointer toegevoegd)
        let html = `
            <div class="week-header" onclick="toggleWeek('${key}')" style="cursor: pointer; user-select: none;">
                <h3 style="display: flex; align-items: center;">
                    <span id="icon-${key}" style="font-size: 14px; margin-right: 8px; transition: transform 0.2s; transform: rotate(${rotation});">▼</span> 
                    Week ${weekNum}
                </h3>
                <span class="badge" style="background: rgba(255,255,255,0.2); color: white;">Totaal: ${group.items.reduce((sum, i) => sum + parseFloat(i.uren), 0)} uur</span>
            </div>
            
            <div id="content-${key}" class="${isHidden}">
                <div class="week-summary">${totalsHTML}</div>
        `;

        group.items.forEach(item => {
            const datumNL = new Date(item.datum).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
            
            const veiligAdres = sanitizeHTML(item.adres);
            const veiligeOmschrijving = sanitizeHTML(item.omschrijving);
            const naamVoorAt = sanitizeHTML(item.userEmail.split('@')[0]);

            html += `
                <div class="uren-card">
                    <div class="uren-card-header">
                        <strong>${datumNL}</strong>
                        <div class="action-buttons">
                            <button class="btn-icon" onclick="editUren('${item.id}')" title="Bewerken">✏️</button>
                            <button class="btn-icon btn-delete" onclick="verwijderUren('${item.id}')" title="Verwijderen">🗑️</button>
                        </div>
                    </div>
                    <div>
                        <span class="badge">${item.uren} uur</span> - <strong>${veiligeOmschrijving}</strong><br>
                        <span style="color: #6c757d; font-size: 14px;">📍 ${veiligAdres}</span><br>
                        <span style="color: #0056b3; font-size: 13px; font-weight: 600; margin-top: 5px; display: inline-block;">👤 ${naamVoorAt}</span>
                    </div>
                </div>
            `;
        });
        
        html += `</div>`; // Sluit de inklapbare div af
        
        weekDiv.innerHTML = html;
        lijst.appendChild(weekDiv);
    });
}

// BEWERKEN
window.editUren = function(id) {
    const item = urenData.find(u => u.id === id);
    if(!item) return;
    
    editingId = id;
    document.getElementById('form-title').innerText = "Uren bewerken";
    document.getElementById('datum').value = item.datum;
    document.getElementById('uren').value = item.uren;
    document.getElementById('adres').value = item.adres;
    
    const radios = document.getElementsByName('omschrijving');
    let found = false;
    for(let r of radios) {
        if(r.value === item.omschrijving) {
            r.checked = true; found = true;
            document.getElementById('andere-tekst').classList.add('hidden');
        }
    }
    if(!found) {
        document.getElementById('radio-andere').checked = true;
        document.getElementById('andere-tekst').value = item.omschrijving;
        document.getElementById('andere-tekst').classList.remove('hidden');
    }

    document.getElementById('submit-btn').innerText = "Opslaan (Bewerken)";
    document.getElementById('cancel-edit-btn').classList.remove('hidden');
    
    window.showTab('form-tab');
    window.checkUren(); 
}

window.cancelEdit = function() {
    editingId = null;
    document.getElementById('uren-form').reset();
    document.getElementById('form-title').innerText = "Uren invullen";
    document.getElementById('submit-btn').innerText = "Opslaan";
    document.getElementById('cancel-edit-btn').classList.add('hidden');
    document.getElementById('andere-tekst').classList.add('hidden');
}

// VERWIJDEREN
window.verwijderUren = async function(id) {
    if(confirm("Weet je zeker dat je deze uren wilt verwijderen?")) {
        try {
            await deleteDoc(doc(db, "uren", id));
            await haalUrenOp();
            if(editingId === id) window.cancelEdit();
        } catch (error) {
            alert("Fout bij verwijderen.");
        }
    }
}

// EXPORTEREN 
window.exportToCSV = function() {
    if(urenData.length === 0) { alert("Geen data."); return; }
    let csvContent = "data:text/csv;charset=utf-8,Schilder,Datum,Uren,Adres,Omschrijving\n";
    urenData.forEach(row => {
        const safeAdres = sanitizeCSV(row.adres).replace(/"/g, '""'); 
        const safeOmschrijving = sanitizeCSV(row.omschrijving).replace(/"/g, '""');
        csvContent += `${row.userEmail},${row.datum},${row.uren},"${safeAdres}","${safeOmschrijving}"\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "urenregistratie.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
