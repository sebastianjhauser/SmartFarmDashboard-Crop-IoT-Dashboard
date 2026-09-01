//every fetch() call for the app lives in this one file.
//each function: fetch, check res.ok, throw a plain Error with the backend's
//message on failure, otherwise return the parsed JSON.

async function handleResponse(res) {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Something went wrong');
  }
  return data;
}

export async function getCrops() {
  const res = await fetch('/api/crops');
  return handleResponse(res);
}

export async function createCrop(data) {
  const res = await fetch('/api/crops', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function updateCrop(id, data) {
  const res = await fetch(`/api/crops/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function deleteCrop(id) {
  const res = await fetch(`/api/crops/${id}`, { method: 'DELETE' });
  return handleResponse(res);
}

export async function getReadings() {
  const res = await fetch('/api/readings');
  return handleResponse(res);
}
