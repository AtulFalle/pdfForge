FROM rust:1-bookworm AS builder

WORKDIR /app
COPY server/ ./
RUN cargo build --release --locked

FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /tmp/pdfforge \
    && chown nobody:nogroup /tmp/pdfforge

COPY docker/entrypoint.sh /usr/local/bin/pdfforge-entrypoint
RUN chmod 755 /usr/local/bin/pdfforge-entrypoint

COPY --from=builder /app/target/release/pdfforge /usr/local/bin/pdfforge

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/pdfforge-entrypoint"]
CMD ["pdfforge"]
