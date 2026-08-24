"""Pydantic schemas for company profile management."""

from pydantic import BaseModel, Field


class CompanyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    industry: str | None = Field(default=None, max_length=200)
    website: str | None = Field(default=None, max_length=500)
    description: str | None = None
    logo_url: str | None = Field(default=None, max_length=1000)


class CompanyDetail(BaseModel):
    id: str
    name: str
    industry: str | None = None
    website: str | None = None
    description: str | None = None
    logo_url: str | None = None
    created_at: str
    updated_at: str
