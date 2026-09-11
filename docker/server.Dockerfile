FROM rust:1-bookworm AS builder

WORKDIR /app
COPY server/ ./
RUN cargo build --release --locked

FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/pdfforge /usr/local/bin/pdfforge

EXPOSE 3000

USER nobody

CMD ["pdfforge"]
