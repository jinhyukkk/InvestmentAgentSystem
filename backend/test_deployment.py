"""배포 설정 및 프로덕션 서빙 검증 테스트.

1) /api/health 헬스체크 엔드포인트 동작
2) 정적 파일 서빙: 루트(/) 및 SPA 라우팅 경로에서 index.html 반환
3) /assets/* 정적 에셋 서빙
4) /api/* 미존재 엔드포인트 404 반환
5) SQLite 폴백 및 데이터베이스 영속성 동작
6) CORS 헤더 동작
"""
import os
import tempfile
from fastapi.testclient import TestClient
from sqlalchemy import text

# 테스트용 환경변수
test_db = os.path.join(tempfile.gettempdir(), "test_deploy.db")
os.environ["DATABASE_URL"] = f"sqlite:///{test_db}"
os.environ["WRKS_API_KEY"] = "test-key"

import db
import main

client = TestClient(main.app)


def test_health_check():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_cors_headers():
    resp = client.options(
        "/api/health",
        headers={
            "Origin": "http://example.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert resp.headers.get("access-control-allow-origin") in ("*", "http://example.com")


def test_static_and_spa_routing():
    # 1. 루트 경로
    resp = client.get("/")
    assert resp.status_code == 200
    assert "html" in resp.headers.get("content-type", "").lower()
    assert "<div id=\"root\"></div>" in resp.text or "<!doctype html>" in resp.text.lower()

    # 2. SPA 라우팅 (임의의 프론트엔드 서브 경로)
    resp_spa = client.get("/dashboard")
    assert resp_spa.status_code == 200
    assert "<!doctype html>" in resp_spa.text.lower()

    # 3. /api 하위의 없는 경로는 404
    resp_api_404 = client.get("/api/nonexistent-endpoint")
    assert resp_api_404.status_code == 404


def test_sqlite_fallback_and_crud():
    db.init_db()
    with db.Session(db.engine) as s:
        s.execute(text("DELETE FROM turns"))
        s.execute(text("DELETE FROM reviews"))
        s.commit()

    # 안건 생성
    rid = db.create_review("deploy-test-chat-1", "배포 테스트 안건", [{"name": "test.pdf"}])
    assert rid is not None

    # 조회
    review = db.get_review(rid)
    assert review is not None
    assert review["company"] == "배포 테스트 안건"
    assert review["status"] == "검토 중"

    # 수정
    updated = db.update_review(rid, {"company": "테스트회사", "committee": "승인"})
    assert updated["company"] == "테스트회사"
    assert updated["status"] == "완료"


def test_dockerfile_exists():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    dockerfile_path = os.path.join(root_dir, "Dockerfile")
    assert os.path.exists(dockerfile_path), "Dockerfile 이 루트에 존재해야 합니다"
    with open(dockerfile_path, "r", encoding="utf-8") as f:
        content = f.read()
    assert "FROM node" in content
    assert "FROM python" in content
    assert "EXPOSE 8787" in content
    assert "PORT" in content


if __name__ == "__main__":
    test_health_check()
    test_cors_headers()
    test_static_and_spa_routing()
    test_sqlite_fallback_and_crud()
    test_dockerfile_exists()
    print("test_deployment OK")
