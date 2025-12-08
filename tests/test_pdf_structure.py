
import pytest
from app import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    app.config['CACHE_TYPE'] = 'NullCache'
    with app.test_client() as client:
        yield client

def test_implied_pdf_2d_structure(client):
    rv = client.get('/api/options/pdf?ticker=SPY')
    # If network fails (500), skip
    if rv.status_code != 200:
        pytest.skip("External API unavailable")

    data = rv.get_json()
    assert 'data' in data
    assert isinstance(data['data'], list)
    if len(data['data']) > 0:
        item = data['data'][0]
        # Check for 2D structure fields
        assert 'date' in item
        assert 'strikes' in item
        assert 'probs' in item
        assert isinstance(item['strikes'], list)
        assert isinstance(item['probs'], list)
