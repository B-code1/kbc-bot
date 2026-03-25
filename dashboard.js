import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, query, orderBy, doc, getDoc, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = window.__FIREBASE_CONFIG__;
let activeView = "pending";
let pendingTickets = [];
let resolvedTickets = [];

function formatTicketTime(value) {
  if (!value) return "Just now";
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000).toLocaleString();
  if (typeof value.toDate === "function") return value.toDate().toLocaleString();
  return "Just now";
}

function renderTickets(container) {
  const isPendingView = activeView === "pending";
  const list = isPendingView ? pendingTickets : resolvedTickets;

  container.innerHTML = "";

  if (list.length === 0) {
    const message = isPendingView
      ? "No active tickets. All clear!"
      : "No resolved tickets yet.";
    container.innerHTML = `<div class="text-center mt-5"><p>${message}</p></div>`;
    return;
  }

  list.forEach((ticketDoc) => {
    const ticket = ticketDoc.data;
    const createdTime = formatTicketTime(ticket.created_at);
    const resolvedTime = formatTicketTime(ticket.resolved_at);
    const userName = (ticket.staff_id || "unknown").split("@")[0];

    const card = isPendingView
      ? `
        <div class="col-md-6 mb-3">
            <div class="card ticket-card shadow-sm">
                <div class="card-body">
                    <h5 class="card-title">User: ${userName}</h5>
                    <h6 class="card-subtitle mb-2 text-muted">${createdTime}</h6>
                    <p class="card-text"><strong>Issue:</strong> ${ticket.issue_description || "No description"}</p>
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="status-pending">● ${ticket.status || "Pending"}</span>
                        <button class="btn btn-sm btn-outline-success" data-id="${ticketDoc.id}">Mark Resolved</button>
                    </div>
                </div>
            </div>
        </div>
      `
      : `
        <div class="col-md-6 mb-3">
            <div class="card ticket-card shadow-sm">
                <div class="card-body">
                    <h5 class="card-title">User: ${userName}</h5>
                    <h6 class="card-subtitle mb-2 text-muted">Created: ${createdTime}</h6>
                    <h6 class="card-subtitle mb-2 text-muted">Resolved: ${resolvedTime}</h6>
                    <p class="card-text"><strong>Issue:</strong> ${ticket.issue_description || "No description"}</p>
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="status-resolved">● ${ticket.status || "Resolved"}</span>
                        <span class="badge bg-success-subtle text-success-emphasis">Done</span>
                    </div>
                </div>
            </div>
        </div>
      `;

    container.innerHTML += card;
  });
}

async function initializeFirebase() {
  try {
    if (!firebaseConfig || !firebaseConfig.apiKey || !firebaseConfig.projectId) {
      throw new Error("Missing dashboard Firebase config. Create dashboard-config.local.js from dashboard-config.example.js");
    }

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const container = document.getElementById('ticket-container');
    const pendingButton = document.getElementById('menu-pending');
    const historyButton = document.getElementById('menu-history');

    pendingButton.addEventListener('click', () => {
      activeView = "pending";
      pendingButton.classList.add('active');
      pendingButton.classList.remove('btn-outline-primary');
      pendingButton.classList.add('btn-primary');
      historyButton.classList.remove('active');
      historyButton.classList.remove('btn-primary');
      historyButton.classList.add('btn-outline-primary');
      renderTickets(container);
    });

    historyButton.addEventListener('click', () => {
      activeView = "history";
      historyButton.classList.add('active');
      historyButton.classList.remove('btn-outline-primary');
      historyButton.classList.add('btn-primary');
      pendingButton.classList.remove('active');
      pendingButton.classList.remove('btn-primary');
      pendingButton.classList.add('btn-outline-primary');
      renderTickets(container);
    });

    container.addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-id]');
      if (!button) return;

      const ticketId = button.dataset.id;
      if (!ticketId) return;

      button.disabled = true;
      button.textContent = 'Resolving...';

      try {
        const ticketRef = doc(db, "tickets", ticketId);
        const historyRef = doc(db, "ticket_history", ticketId);
        const ticketSnapshot = await getDoc(ticketRef);

        if (!ticketSnapshot.exists()) {
          return;
        }

        const ticketData = ticketSnapshot.data();

        await setDoc(historyRef, {
          ...ticketData,
          status: "Resolved",
          resolved_at: serverTimestamp(),
          resolved_by: "KBC IT Dashboard"
        });

        await deleteDoc(ticketRef);
      } catch (resolveError) {
        console.error("Could not resolve ticket:", resolveError);
        button.disabled = false;
        button.textContent = 'Mark Resolved';
      }
    });

    // Listen for tickets in real-time
    const pendingQuery = query(collection(db, "tickets"), orderBy("created_at", "desc"));
    const historyQuery = query(collection(db, "ticket_history"), orderBy("resolved_at", "desc"));

    onSnapshot(pendingQuery, (snapshot) => {
      pendingTickets = snapshot.docs.map((ticketDoc) => ({ id: ticketDoc.id, data: ticketDoc.data() }));
      renderTickets(container);
    });

    onSnapshot(historyQuery, (snapshot) => {
      resolvedTickets = snapshot.docs.map((ticketDoc) => ({ id: ticketDoc.id, data: ticketDoc.data() }));
      renderTickets(container);
    });

  } catch (error) {
    console.error("Could not initialize Firebase:", error);
    const container = document.getElementById('ticket-container');
    container.innerHTML = `<div class="alert alert-danger">Missing dashboard Firebase config. Create dashboard-config.local.js from dashboard-config.example.js.</div>`;
  }
}

initializeFirebase();