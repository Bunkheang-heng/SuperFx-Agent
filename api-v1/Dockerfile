FROM python:3.12-slim

WORKDIR /app

# MetaTrader5 is Windows-only on PyPI. The codebase treats a missing import as
# "no MT5"; for live trading run the API on the Windows host, not in Linux.
COPY requirements.txt .
RUN grep -v '^[[:space:]]*MetaTrader5[[:space:]]*$' requirements.txt > /tmp/req.txt \
    && pip install --no-cache-dir -r /tmp/req.txt

COPY app/ ./app/
COPY run.py .

ENV PYTHONUNBUFFERED=1
ENV APP_HOST=0.0.0.0
ENV APP_PORT=8000
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
