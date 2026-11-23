# AP Physics C Practice Lab

Live site: https://ap-physics-c-site.vercel.app

A practice site for AP Physics C (Mechanics + E&M):

- 13 units with key equations and short explanations (English + Russian notes)
- Multiple-choice practice with answer checking and explanations
- Timed AP-style practice tests (2 min per question) with per-unit results
- **Teacher mode** (code-protected): import MCQ from PDF / text / CSV / JSON, auto-sorted into units by keywords; figures are cut from PDF pages automatically or pasted as screenshots; publish to all students
- **Student sign-in by name** (no password); finished tests are sent to the teacher, who sees per-student and per-unit results and can export CSV

## Structure

| Path | What it is |
|---|---|
| `index.html` | The whole front end (single file, no build step) |
| `api/questions.js` | Shared question bank (read: everyone, write: teacher) |
| `api/upload.js` | Figure upload (teacher) |
| `api/results.js` | Student test results (submit: everyone, read/delete: teacher) |
| `api/_lib.js` | Teacher-code check helpers |

Data is stored in Vercel Blob.

## Deploy

Environment variables (set in Vercel, never committed):

- `TEACHER_CODE` – the code the teacher types to enter teacher mode
- `BLOB_READ_WRITE_TOKEN` – added automatically when a Blob store is connected to the project

The Vercel project is connected to this repo: every push to `main` deploys to production automatically. Manual deploy is still possible:

```bash
npx vercel --prod
```
