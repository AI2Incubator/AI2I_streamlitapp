FROM python:3.8.13-slim

# set working directory
WORKDIR /usr/src/app

ENV PYTHONPATH "/usr/src/app/${PYTHONPATH}"

# set environment varibles
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# add and install requirements
COPY ./requirements.txt ./requirements.txt
RUN pip install -r requirements.txt

# run server
COPY *.py ./
EXPOSE 8501
CMD streamlit run app.py