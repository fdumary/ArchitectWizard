// backend/fetch_live_data.js
const fs = require('fs');

async function fetchFloridaProjects() {
  // Layer 2 is the actual "Construction Phase" layer on FDOT's GIS server
  // Querying upcoming projects in Orange, Volusia, Hillsborough, and Miami-Dade
  const url = "https://gis.fdot.gov/arcgis/rest/services/Work_Program_Current/FeatureServer/2/query?" +
    new URLSearchParams({
      where: "CONTYNAM IN ('ORANGE', 'VOLUSIA', 'HILLSBOROUGH', 'MIAMI-DADE')",
      outFields: "LOCALFULL,CONTYNAM,WPWKMIXN,FISCALYR",
      returnGeometry: "false",
      f: "json",
      resultRecordCount: "25"
    });

  console.log("Fetching live projects from Florida FDOT Open Data...");

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (!data.features || data.features.length === 0) {
      console.error("No records found. Check query params.");
      return;
    }

    const sampleUtilities = [
      "Florida Power & Light (FPL)",
      "Duke Energy Florida",
      "Orlando Utilities Commission (OUC)",
      "Tampa Electric Company (TECO)"
    ];

    const formattedProjects = data.features.map((item, index) => {
      const attr = item.attributes;
      const rawCounty = (attr.CONTYNAM || "Orange").trim();
      const county = rawCounty
        .toLowerCase()
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('-');
      const company = sampleUtilities[index % sampleUtilities.length];

      return {
        title: attr.LOCALFULL || "Florida Infrastructure Enhancement",
        company: company,
        county: county,
        description: attr.WPWKMIXN || "Right-of-way linear utility and roadway modernization",
        startTime: "2026-10-01T08:00:00Z",
        endTime: "2027-04-30T17:00:00Z"
      };
    });

    fs.writeFileSync('projects.json', JSON.stringify(formattedProjects, null, 2));
    console.log(`Successfully fetched and saved ${formattedProjects.length} real Florida projects into projects.json!`);
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

fetchFloridaProjects();