# datacleaner — full stack starter

## Prerequisites (Windows)
- Install Windows CPython 3.11+ from python.org (check "Add Python to PATH")
- Install Node.js 16+ (for frontend)
- Optional: Miniconda if you prefer conda environments

## Backend setup (PowerShell)
cd datacleaner\backend

# create a Windows venv using the installed Python
python -m venv .venv

# allow activation for this session and activate
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
.\.venv\Scripts\Activate.ps1

# upgrade pip and install requirements
python -m pip install --upgrade pip setuptools wheel
python -m pip install -r requirements.txt

# run the backend
python -m uvicorn src.app:app --reload --port 8000

## Frontend setup (PowerShell)
cd datacleaner\frontend
npm install
npm run dev

Open frontend at http://localhost:5173 and backend at http://127.0.0.1:8000

If you prefer Conda:
# create conda env
conda create -n datacleaner python=3.11 -y
conda activate datacleaner

# install backend deps via conda-forge (avoids building wheels)
conda install -c conda-forge fastapi uvicorn pandas python-dotenv -y

# run backend
python -m uvicorn src.app:app --reload --port 8000
