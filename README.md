# Gastos App — Flask + React + SQLAlchemy + MUI

Aplicativo web para controle de finanças pessoais com:
- **Backend**: Flask (Python) + SQLAlchemy + Alembic (migrações)
- **Frontend**: React (Vite) + Material UI
- **Banco**: SQLite local por padrão (pode trocar por Postgres depois)
- **Regras de negócio** com “dono do sistema” via variável de ambiente `USUARIO`

---

## 1) Pré-requisitos

### Windows (recomendado)
- **Python 3.9** (64-bit)  
  Baixe em: https://www.python.org/downloads/release/python-3913/
  > Na instalação, marque **“Add Python to PATH”**.
- **Node.js 22.19**  
  Baixe em: https://nodejs.org/en/download
- **Git**  
  Baixe em: https://git-scm.com/downloads





---

## 2) Baixar o projeto

No **terminal** (CMD no Windows), escolha uma pasta e rode:

```bash
git clone https://github.com/lucascapl/gastos-app.git
cd gastos-app
```


---

## 3) Configurar o Backend (Flask)


### 3.1 Criar ambiente virtual (venv) e ativar

**Windows (CMD):**
```powershell
python -m venv .venv

**Caso ja tenha iniciado a primeira vez, executar somente os comandos abaixo**
.venv\Scripts\activate
pip install -r requirements.txt

```


> Sempre que abrir um novo terminal, ative o venv de novo antes de rodar o backend.


### 3.2 Criar o arquivo `.env` (na **raiz** do projeto)

Crie um arquivo chamado `.env` com este conteúdo:

```
# Dono do sistema (usado nas regras de saldo/faturas)
USUARIO=Gui

# Banco local SQLite (arquivo gastos.db será criado na raiz)
DATABASE_URL=sqlite:///gastos.db
```

> Em produção, você pode usar Postgres (Neon/Supabase), por exemplo:  
> `DATABASE_URL=postgresql+psycopg2://usuario:senha@host:5432/nome_db`

### 3.4 Criar as tabelas (migrações Alembic)

Ainda na raiz do projeto (com o venv ativo):

```bash
alembic upgrade head
```

> Se der erro de URL do banco, revise o `.env` e tente novamente.

### 3.5 Rodar o backend

**Opção A — recomendada no desenvolvimento:**

**CMD (Windows):**
```cmd
set FLASK_APP=backend.app
set FLASK_RUN_PORT=5000
set FLASK_ENV=development
flask run --debug
```

Se deu certo, acesse:
- **Saúde**: http://localhost:5000/health → deve mostrar `{"status":"ok"}`
- **Balanço**: http://localhost:5000/balance
- **Whoami (owner)**: http://localhost:5000/whoami
- **Transações**: http://localhost:5000/transactions

---

## 4) Configurar o Frontend (React + Vite + MUI)

Abra um **novo terminal** (deixe o backend rodando no outro terminal) e vá para a pasta do frontend:

```bash
cd frontend
```

### 4.1 Criar o arquivo `frontend/.env`

```
VITE_API_URL=http://localhost:5000
```

### 4.2 Instalar dependências

```bash
npm install
```

> Se aparecer erro de versão do Node, confirme que está usando **Node 22.19** (`node -v`).

### 4.3 Rodar o frontend

```bash
npm run dev
```

Acesse: **http://localhost:5173**

Você deve ver o app carregando e se comunicando com o backend.

---

## 5) Como usar

1. **Adicionar transações** no formulário superior:  
   - **Valor**: negativo para gastos, positivo para receitas  
   - **Evento**: descrição (ex.: “Mercado”, “Salário”)  
   - **Dia**: data no formato `YYYY-MM-DD`  
   - **Categoria / Pagamento / Pessoa**: seletores com opções do banco (pode digitar novo)
   - Se **Pessoa** ficar **vazio**, o backend assume automaticamente o **USUARIO** do `.env` (ex.: Lucas).

2. **Regras de negócio (resumo)**  
   - Transações do **USUARIO** afetam o **Saldo total** diretamente.  
   - Gastos de **outras pessoas** no **Crédito** não afetam o saldo na hora; entram em **Faturas por pessoa**.  
   - Gastos de **outras pessoas** no **Débito** afetam o saldo e entram em **Me devem**.  
   - **Reembolsos**:
     - `reembolso_credito`: **não** altera o saldo; **abate** a fatura da pessoa.
     - `reembolso_debito`: **aumenta** o saldo; **abate** o “me devem” da pessoa.

3. **Owner (USUARIO)**  
   - O card de saldo mostra o **Dono** (ex.: “User: Lucas”).  
   - Quer trocar? Edite `USUARIO=` no `.env`, pare e rode o backend novamente.

---

## 6) Estrutura de pastas (resumo)

```
gastos-app/
  backend/
    api/
      transactions.py   # CRUD + /transactions/options
      balance.py        # /balance e /whoami
    app.py              # Flask app + Blueprints
    db.py               # Engine, Session, Base
    models.py           # SQLAlchemy models
    settings.py         # lê USUARIO do .env
  frontend/
    src/
      components/       # MUI components
      api.js            # axios + util getOwner()
      App.jsx           # tela principal
      main.jsx          # ThemeProvider e toggle dark mode
      theme.js          # tema MUI (light/dark)
    .env                # VITE_API_URL=http://localhost:5000
  alembic/              # migrações do banco
  alembic.ini
  .env                  # USUARIO e DATABASE_URL
  README.md
```

---

## 7) Problemas comuns & soluções

- **`DATABASE_URL` None / erro no create_engine**  
  → Verifique se `.env` está na **raiz** e contém `DATABASE_URL=sqlite:///gastos.db`.  
  → Pare e rode o backend de novo.

- **`NoSuchModuleError: sqlalchemy.dialects:driver`**  
  → Em `alembic.ini` não use `driver://...`. Use:  
  `sqlite:///gastos.db` (SQLite) ou `postgresql+psycopg2://...` (Postgres)

- **Node: “Vite requires Node 20.19+”**  
  → Instale Node **22.19**. No Windows, prefira **nvm-windows**:
  ```
  nvm install 22.19.0
  nvm use 22.19.0
  node -v
  ```

- **CORS / Frontend não consegue chamar backend**  
  → O backend já tem `CORS(app)`. Confirme `VITE_API_URL` em `frontend/.env`.  
  → Reinicie `npm run dev` após mudar variáveis.

- **BalanceCard não atualiza após adicionar transação**  
  → Já resolvido: o App manda um “refreshKey” pro card após cada POST.

---

## 8) Parar servidores

- **Backend (Flask)**: `Ctrl + C` no terminal onde está rodando  
- **Frontend (Vite)**: `Ctrl + C` no terminal do `npm run dev`

---

## 9) Próximos passos

- Deploy (Render + Vercel + Neon/Supabase)
- Autenticação (JWT)
- Filtros no backend por query params (p/ grandes volumes)
- Dashboards com gráficos (recharts / MUI X Charts)

---

**Pronto!** Seguindo esse guia, qualquer pessoa consegue colocar o projeto no ar localmente.
