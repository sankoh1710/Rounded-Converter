from datetime import date
from decimal import Decimal, ROUND_CEILING
from typing import Annotated, Literal
import json

import httpx
from fastapi import FastAPI, HTTPException, Path, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


FRANKFURTER_API = "https://api.frankfurter.dev"

app = FastAPI(
    title="RCC API",
    description="Rounded Currency Converter backend built with FastAPI.",
    version="1.0.0",
)


# Allows your HTML/JavaScript frontend to communicate with FastAPI.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "https://rounded-converter.netlify.app",
    ],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


class ConversionResponse(BaseModel):
    date: str
    from_currency: str
    to_currency: str
    amount: float
    rate: float
    exact_result: float
    rounded_result: float
    rounded_to: float
    difference: float
    rounding_direction: Literal["up", "down", "exact"]


def round_up(
    value: Decimal,
    nearest: Decimal = Decimal("1"),
) -> Decimal:
    units = (value / nearest).to_integral_value(
        rounding=ROUND_CEILING
    )

    return units * nearest  



def as_display_number(value: Decimal) -> float:
    """
    Limit the API response to four decimal places.
    """

    displayed_value = value.quantize(
        Decimal("0.0001"),
        rounding=ROUND_CEILING,
    )

    return float(displayed_value)


@app.get("/")
async def home() -> dict[str, str]:
    return {
        "name": "RCC API",
        "message": "Use /convert/{from_currency}/{to_currency}",
        "documentation": "/docs",
    }


@app.get("/health")
async def health() -> dict[str, str]:
    return {
        "status": "ok",
    }


@app.get(
    "/convert/{from_currency}/{to_currency}",
    response_model=ConversionResponse,
)
async def convert_currency(
    from_currency: Annotated[
        str,
        Path(
            min_length=3,
            max_length=3,
            pattern=r"^[A-Za-z]{3}$",
            description="Source currency code, such as USD",
        ),
    ],
    to_currency: Annotated[
        str,
        Path(
            min_length=3,
            max_length=3,
            pattern=r"^[A-Za-z]{3}$",
            description="Target currency code, such as TRY",
        ),
    ],
    amount: Annotated[
        Decimal,
        Query(
            gt=0,
            description="Amount to convert",
        ),
    ] = Decimal("1"),
    nearest: Annotated[
        Decimal,
        Query(
            gt=0,
            description="Round to the nearest 1, 5, 10, 0.5, etc.",
        ),
    ] = Decimal("1"),
) -> ConversionResponse:

    base = from_currency.upper()
    quote = to_currency.upper()

    # No API request is needed when both currencies are the same.
    if base == quote:
        rate = Decimal("1")
        rate_date = date.today().isoformat()

    else:
        url = f"{FRANKFURTER_API}/v2/rate/{base}/{quote}"

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url)

        except httpx.RequestError as error:
            raise HTTPException(
                status_code=503,
                detail="The exchange-rate service is unavailable.",
            ) from error

        if response.status_code != 200:
            try:
                error_data = response.json()
                message = error_data.get(
                    "message",
                    "Currency conversion failed.",
                )

            except ValueError:
                message = "Currency conversion failed."

            raise HTTPException(
                status_code=response.status_code,
                detail=message,
            )

        try:
            # Parse floating-point rates as Decimal.
            data = json.loads(
                response.text,
                parse_float=Decimal,
            )

            rate = Decimal(data["rate"])
            rate_date = data["date"]

        except (KeyError, TypeError, ValueError) as error:
            raise HTTPException(
                status_code=502,
                detail="The rate service returned an unexpected response.",
            ) from error

    exact_result = amount * rate

    rounded_result = round_up(
        exact_result,
        nearest,
)

    exact_result = amount * rate
    rounded_result = round_up(exact_result, nearest)
    difference = rounded_result - exact_result

    rounding_direction = (
        "exact"
        if difference == 0
        else "up"
)

    return ConversionResponse(
        date=rate_date,
        from_currency=base,
        to_currency=quote,
        amount=as_display_number(amount),
        rate=as_display_number(rate),
        exact_result=as_display_number(exact_result),
        rounded_result=as_display_number(rounded_result),
        rounded_to=as_display_number(nearest),
        difference=as_display_number(difference),
        rounding_direction=rounding_direction,
    )