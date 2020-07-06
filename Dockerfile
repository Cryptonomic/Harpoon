FROM python:3.8

COPY . .

WORKDIR /server
RUN pip install --no-cache-dir -r requirements.txt
RUN chmod +x startup.sh
ENTRYPOINT ["./startup.sh"]
CMD ["0"]


