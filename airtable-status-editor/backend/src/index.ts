import express from 'express';
import cors from 'cors';
import Airtable from 'airtable';

const app = express();
app.use(express.json());
app.use(cors());

const getBase = () =>
  new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
    .base(process.env.AIRTABLE_BASE_ID!);

const TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || 'Table 1';

// GET /api/records
app.get('/api/records', async (req, res) => {
  try {
    const records: any[] = [];
    await getBase()(TABLE_NAME)
      .select({
        fields: ['Issue ID', 'Issue', 'Description', 'Screenshot', 'Dimension', 'Theme', 'Severity', 'Issue Resolution'],
        filterByFormula: "NOT({Dimension} = '')",
      })
      .eachPage((pageRecords, fetchNextPage) => {
        pageRecords.forEach((r) => records.push({ id: r.id, fields: r.fields }));
        fetchNextPage();
      });
    res.json({ records });
  } catch (err: any) {
    console.error('Airtable records fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch records', details: err?.message });
  }
});

// PATCH /api/records/:id
app.patch('/api/records/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;
    const updateFields: Record<string, any> = {};

    if ('Decision' in body) updateFields.Decision = body.Decision;
    if ('Resolution' in body) updateFields.Resolution = body.Resolution;
    if ('Comments' in body) updateFields.Comments = body.Comments;

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const updated = await getBase()(TABLE_NAME).update(id, updateFields);
    res.json({ id: updated.id, fields: updated.fields });
  } catch (err) {
    console.error('Airtable update error:', err);
    res.status(500).json({ error: 'Failed to update record' });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Backend running on port ${port}`));