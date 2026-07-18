import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app

client = TestClient(app)


@pytest.fixture
def image_id() -> str:
    buf = io.BytesIO()
    Image.new("RGB", (800, 600), "#88aa66").save(buf, format="JPEG")
    res = client.post(
        "/api/photos", files={"file": ("garden.jpg", buf.getvalue(), "image/jpeg")}
    )
    assert res.status_code == 200
    body = res.json()
    assert body["width"] == 800 and body["height"] == 600
    return body["imageId"]


def test_health():
    assert client.get("/api/health").json()["status"] == "ok"


def test_segment_point_prompt(image_id):
    res = client.post(
        f"/api/photos/{image_id}/segment",
        json={"points": [{"x": 400, "y": 300, "label": 1}]},
    )
    assert res.status_code == 200
    regions = res.json()["regions"]
    assert len(regions) == 1
    region = regions[0]
    assert len(region["polygon"]) >= 3
    assert region["areaPx"] > 0
    assert 0 <= region["score"] <= 1
    for x, y in region["polygon"]:
        assert 0 <= x <= 800 and 0 <= y <= 600


def test_segment_unknown_image():
    res = client.post("/api/photos/nope/segment", json={})
    assert res.status_code == 404


def test_rectify(image_id):
    res = client.post(
        f"/api/photos/{image_id}/rectify",
        json={
            "corners": [[100, 100], [700, 120], [750, 500], [80, 480]],
            "realWidth": 10,
            "realHeight": 6,
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["pixelsPerUnit"] > 0
    assert body["width"] == round(10 * body["pixelsPerUnit"])
    # Rectified image is retrievable under its new id.
    img = client.get(f"/api/photos/{body['imageId']}/image")
    assert img.status_code == 200
    assert img.headers["content-type"] == "image/png"
