const express = require('express');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

const CONFIG = process.argv.slice(2)[0] || 'config.yaml';

let config;

try {
  config = yaml.load(
    fs.readFileSync(path.join(__dirname, CONFIG), 'utf8')
  );
} catch (error) {
  console.error('Error reading or parsing config:', error);
  process.exit(1);
}

app.use(express.json());
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

function checkRoute(req, res, next) {
  const route = req.params.route;

  if (!config.routes.includes(route)) {
    return res.status(404).json({
      error: `Route ${route} not found`
    });
  }

  next();
}

// ?embed=owners uses the relationship with foreignKey ownerIds
function embedRecord(record, route, embed) {
  const relationships = config.relationships?.[route] || [];
  const relation = relationships.find(rel => rel.foreignKey.replace('Ids', 's') === embed);

  if (!relation) {
    return record;
  }

  const ids = record[relation.foreignKey] || [];
  const related = config[relation.relatedRoute] || [];

  // copy, so the embedded data is not saved into config
  return { ...record, [embed]: related.filter(item => ids.includes(item.id)) };
}

app.get('/', (req, res) => {
  const routes = config.routes.map(route => ({
    name: route,
    count: (config[route] || []).length
  }));

  res.render('index', { routes });
});

app.get('/:route', checkRoute, (req, res) => {
  const route = req.params.route;
  const { embed } = req.query;
  const data = config[route] || [];

  res.json(data.map(record => embedRecord(record, route, embed)));
});

app.get('/:route/:id', checkRoute, (req, res) => {
  const route = req.params.route;
  const id = req.params.id;
  const { embed } = req.query;
  const data = config[route] || [];

  const record = data.find(item => item.id == id);

  if (!record) {
    return res.status(404).json({
      error: `Record with ID ${id} not found in ${route}`
    });
  }

  res.json(embedRecord(record, route, embed));
});

const server = app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
}).on('error', (err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});

const shutdown = () => {
  console.log('Shutting down...');
  server.close(() => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
