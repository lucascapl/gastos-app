import unittest
from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from backend.app import create_app
from backend.db import Base, SessionLocal, engine as application_engine
from backend.models import Category, Person, Transaction, TxType


class MonthlyBudgetApiTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        SessionLocal.remove()
        SessionLocal.configure(bind=cls.engine)
        cls.app = create_app()
        cls.app.config.update(TESTING=True, JWT_SECRET_KEY="budget-tests-secret-with-at-least-32-bytes")
        cls.client = cls.app.test_client()

    @classmethod
    def tearDownClass(cls):
        SessionLocal.remove()
        Base.metadata.drop_all(cls.engine)
        SessionLocal.configure(bind=application_engine)
        cls.engine.dispose()

    def setUp(self):
        SessionLocal.remove()
        Base.metadata.drop_all(self.engine)
        Base.metadata.create_all(self.engine)

        self.alice_token = self._register("alice")
        self.bob_token = self._register("bob")

        session = SessionLocal()
        try:
            self.alice_food = Category(user_id=1, name="Alimentacao")
            self.alice_home = Category(user_id=1, name="Casa")
            self.alice_transport = Category(user_id=1, name="Transporte")
            self.bob_food = Category(user_id=2, name="Alimentacao")
            self.alice_person = Person(user_id=1, name=" Alice ")
            self.shared_person = Person(user_id=1, name="Carlos")
            session.add_all([
                self.alice_food,
                self.alice_home,
                self.alice_transport,
                self.bob_food,
                self.alice_person,
                self.shared_person,
            ])
            session.commit()
            session.refresh(self.alice_food)
            session.refresh(self.alice_home)
            session.refresh(self.alice_transport)
            session.refresh(self.bob_food)
            session.refresh(self.alice_person)
            session.refresh(self.shared_person)
        finally:
            session.close()

    def _register(self, username):
        response = self.client.post("/auth/register", json={"username": username, "password": "secret"})
        self.assertEqual(response.status_code, 201)
        return response.get_json()["access_token"]

    @staticmethod
    def _headers(token):
        return {"Authorization": f"Bearer {token}"}

    def _create_budget(self, token, category_id, amount="500.00", year=2026, month=10):
        return self.client.post(
            "/budgets",
            headers=self._headers(token),
            json={"category_id": category_id, "amount": amount, "year": year, "month": month},
        )

    def test_create_list_update_and_delete_budget(self):
        response = self._create_budget(self.alice_token, self.alice_food.id)
        self.assertEqual(response.status_code, 201)
        budget = response.get_json()
        self.assertEqual(budget["amount"], 500.0)
        self.assertEqual(budget["category"]["id"], self.alice_food.id)

        listed = self.client.get("/budgets?year=2026&month=10", headers=self._headers(self.alice_token))
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(len(listed.get_json()["items"]), 1)

        updated = self.client.patch(
            f"/budgets/{budget['id']}",
            headers=self._headers(self.alice_token),
            json={"amount": "650.50", "category_id": self.alice_home.id},
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.get_json()["amount"], 650.5)
        self.assertEqual(updated.get_json()["category"]["id"], self.alice_home.id)

        deleted = self.client.delete(f"/budgets/{budget['id']}", headers=self._headers(self.alice_token))
        self.assertEqual(deleted.status_code, 200)
        self.assertTrue(deleted.get_json()["deleted"])

    def test_rejects_invalid_duplicate_and_other_user_category(self):
        for payload in (
            {"category_id": self.alice_food.id, "amount": "0", "year": 2026, "month": 10},
            {"category_id": self.alice_food.id, "amount": "-1", "year": 2026, "month": 10},
            {"category_id": self.alice_food.id, "amount": "1.001", "year": 2026, "month": 10},
            {"category_id": self.alice_food.id, "amount": "1", "year": 2026, "month": 13},
        ):
            response = self.client.post("/budgets", headers=self._headers(self.alice_token), json=payload)
            self.assertEqual(response.status_code, 400)

        other_category = self._create_budget(self.alice_token, self.bob_food.id)
        self.assertEqual(other_category.status_code, 404)

        first = self._create_budget(self.alice_token, self.alice_food.id)
        self.assertEqual(first.status_code, 201)
        duplicate = self._create_budget(self.alice_token, self.alice_food.id)
        self.assertEqual(duplicate.status_code, 409)

        second = self._create_budget(self.alice_token, self.alice_home.id)
        conflict = self.client.patch(
            f"/budgets/{second.get_json()['id']}",
            headers=self._headers(self.alice_token),
            json={"category_id": self.alice_food.id},
        )
        self.assertEqual(conflict.status_code, 409)

    def test_budget_access_is_scoped_to_authenticated_user(self):
        budget = self._create_budget(self.alice_token, self.alice_food.id).get_json()
        response = self.client.patch(
            f"/budgets/{budget['id']}",
            headers=self._headers(self.bob_token),
            json={"amount": "10"},
        )
        self.assertEqual(response.status_code, 404)
        response = self.client.delete(f"/budgets/{budget['id']}", headers=self._headers(self.bob_token))
        self.assertEqual(response.status_code, 404)

    def test_category_with_budget_cannot_be_deleted(self):
        self._create_budget(self.alice_token, self.alice_food.id)
        response = self.client.delete(
            f"/transactions/reference-data/categories/{self.alice_food.id}",
            headers=self._headers(self.alice_token),
        )
        self.assertEqual(response.status_code, 409)

    def test_summary_uses_only_realized_owner_expenses(self):
        budget = self._create_budget(self.alice_token, self.alice_food.id, amount="500.00").get_json()
        september_budget = self._create_budget(self.alice_token, self.alice_food.id, amount="50.00", month=9).get_json()
        over_budget = self._create_budget(self.alice_token, self.alice_home.id, amount="300.00").get_json()
        decimal_budget = self._create_budget(self.alice_token, self.alice_transport.id, amount="1.00", month=11).get_json()

        session = SessionLocal()
        try:
            session.add_all([
                Transaction(user_id=1, category_id=self.alice_food.id, person_id=self.alice_person.id, value="-315.00", event="Mercado", day=date(2026, 10, 5), tx_type=TxType.normal),
                Transaction(user_id=1, category_id=self.alice_food.id, person_id=self.alice_person.id, value="-10.00", event="Mercado", day=date(2026, 9, 5), tx_type=TxType.normal),
                Transaction(user_id=1, category_id=self.alice_food.id, person_id=self.alice_person.id, value="-20.00", event="Parcela 1/2", day=date(2026, 10, 12), tx_type=TxType.normal),
                Transaction(user_id=1, category_id=self.alice_food.id, person_id=self.alice_person.id, value="-50.00", event="Previsto", day=date(2026, 10, 15), is_projected=True, tx_type=TxType.normal),
                Transaction(user_id=1, category_id=self.alice_food.id, person_id=self.alice_person.id, value="-40.00", event="Excluido", day=date(2026, 10, 16), is_deleted=True, tx_type=TxType.normal),
                Transaction(user_id=1, category_id=self.alice_food.id, person_id=self.alice_person.id, value="100.00", event="Reembolso recebido", day=date(2026, 10, 17), tx_type=TxType.normal),
                Transaction(user_id=1, category_id=self.alice_food.id, person_id=self.shared_person.id, value="-80.00", event="Parte de terceiro", day=date(2026, 10, 18), tx_type=TxType.normal),
                Transaction(user_id=1, category_id=self.alice_food.id, person_id=self.alice_person.id, value="30.00", event="Reembolso", day=date(2026, 10, 19), tx_type=TxType.reembolso_debito),
                Transaction(user_id=1, category_id=self.alice_home.id, person_id=self.alice_person.id, value="-350.00", event="Conserto", day=date(2026, 10, 20), tx_type=TxType.normal),
                Transaction(user_id=1, category_id=self.alice_transport.id, person_id=self.alice_person.id, value="-0.10", event="Onibus", day=date(2026, 11, 2), tx_type=TxType.normal),
                Transaction(user_id=1, category_id=self.alice_transport.id, person_id=self.alice_person.id, value="-0.20", event="Metro", day=date(2026, 11, 3), tx_type=TxType.normal),
            ])
            session.commit()
        finally:
            session.close()

        response = self.client.get("/budgets/summary?year=2026&month=10", headers=self._headers(self.alice_token))
        self.assertEqual(response.status_code, 200)
        summary = {item["id"]: item for item in response.get_json()["items"]}

        self.assertEqual(summary[budget["id"]]["actual"], 335.0)
        self.assertEqual(summary[budget["id"]]["remaining"], 165.0)
        self.assertEqual(summary[budget["id"]]["usage_percent"], 67.0)
        self.assertFalse(summary[budget["id"]]["over_budget"])

        self.assertEqual(summary[over_budget["id"]]["actual"], 350.0)
        self.assertEqual(summary[over_budget["id"]]["remaining"], -50.0)
        self.assertTrue(summary[over_budget["id"]]["over_budget"])

        yearly = self.client.get("/budgets/summary?year=2026", headers=self._headers(self.alice_token))
        self.assertEqual(yearly.status_code, 200)
        yearly_summary = {item["id"]: item for item in yearly.get_json()["items"]}
        self.assertEqual(yearly_summary[budget["id"]]["actual"], 335.0)
        self.assertEqual(yearly_summary[september_budget["id"]]["actual"], 10.0)
        self.assertEqual(yearly_summary[decimal_budget["id"]]["actual"], 0.3)
        self.assertEqual(yearly_summary[decimal_budget["id"]]["usage_percent"], 30.0)


if __name__ == "__main__":
    unittest.main()
