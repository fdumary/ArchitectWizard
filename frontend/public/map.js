const countyTitle = document.getElementById('countyTitle');
const projectList = document.getElementById('projectList');
const statusEl = document.getElementById('status');

function setStatus(message, type = 'success') {
  statusEl.textContent = message;
  statusEl.className = 'status';
  statusEl.classList.add(type);
}

function renderProjects(county, projects) {
  countyTitle.textContent = county;

  if (!projects || !projects.length) {
    projectList.innerHTML = '<li>No upcoming projects found for this county.</li>';
    return;
  }

  projectList.innerHTML = projects
    .map((project) => {
      const start = project.startTime ? new Date(project.startTime).toLocaleDateString() : 'Unknown';
      const end = project.endTime ? new Date(project.endTime).toLocaleDateString() : 'Unknown';
      return `
        <li>
          <strong>${project.title || 'Untitled project'}</strong><br />
          ${project.company || 'Unspecified company'}<br />
          ${start} to ${end}
        </li>
      `;
    })
    .join('');
}

async function fetchCountyProjects(county) {
  setStatus(`Loading ${county}...`, 'success');

  try {
    const response = await fetch(`/api/projects/county/${encodeURIComponent(county)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to load county projects.');
    }

    renderProjects(county, data.projects || []);
    setStatus('Projects loaded.', 'success');
  } catch (error) {
    console.error(error);
    projectList.innerHTML = '<li>Unable to load county projects.</li>';
    setStatus(error.message || 'Project load failed.', 'error');
  }
}

const map = L.map('map').setView([27.8, -81.7], 6.5);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors',
  maxZoom: 12
}).addTo(map);

let selectedLayer = null;

fetch('florida-counties.geojson')
  .then((res) => res.json())
  .then((data) => {
    L.geoJSON(data, {
      style: {
        color: '#5e82ad',
        weight: 2,
        fillColor: '#dfeef9',
        fillOpacity: 0.6
      },
      onEachFeature: (feature, layer) => {
        const COUNTYNAME = feature.properties.NAME || feature.properties.COUNTY;

        layer.on('click', () => {
          if (selectedLayer) {
            selectedLayer.setStyle({ fillColor: '#dfeef9', fillOpacity: 0.6 });
          }
          layer.setStyle({ fillColor: '#b9d5f5', fillOpacity: 0.8 });
          selectedLayer = layer;

          fetchCountyProjects(COUNTYNAME);
        });

        layer.on('mouseover', () => {
          if (layer !== selectedLayer) layer.setStyle({ fillColor: '#cee1f5' });
        });

        layer.on('mouseout', () => {
          if (layer !== selectedLayer) layer.setStyle({ fillColor: '#dfeef9' });
        });
      }
    }).addTo(map);
  })
  .catch((error) => {
    console.error('Failed to load county boundaries:', error);
    setStatus('Failed to load map data.', 'error');
  });