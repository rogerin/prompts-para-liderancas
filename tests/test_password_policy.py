import pytest
from fastapi.testclient import TestClient

from app import create_app


def test_accepts_configured_facilitator_password_even_if_shorter_than_16_chars(tmp_path):
    app = create_app(data_dir=tmp_path, password="R0ger!n20100")
    with TestClient(app) as client:
        assert client.get("/").status_code == 200
