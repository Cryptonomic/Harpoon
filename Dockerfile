FROM ubuntu

COPY . .

WORKDIR /server
RUN apt-get update && apt-get install -y libpq-dev \
    libpq-dev \
    python3-pip

RUN python3 -m pip install -r requirements.txt
RUN chmod +x startup.sh
ENTRYPOINT ["./startup.sh"]
CMD ["0"]


