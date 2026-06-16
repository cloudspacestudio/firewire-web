CREATE TABLE dbo.parts(
    [partId] NVARCHAR(40) NOT NULL CONSTRAINT [DF_parts_partId] DEFAULT (CONVERT(NVARCHAR(40), NEWID())) PRIMARY KEY,
    [vendorId] NVARCHAR(40) NOT NULL,
    [sourceVendorName] NVARCHAR(200) NULL,
    [brand] NVARCHAR(200) NULL,
    [parentCategory] NVARCHAR(500) NULL,
    [category] NVARCHAR(500) NULL,
    [partNumber] NVARCHAR(120) NOT NULL,
    [description] NVARCHAR(2000) NULL,
    [msrp] MONEY NULL,
    [cost] MONEY NULL,
    [minQty] INT NULL,
    [upc] NVARCHAR(50) NULL,
    [productStatus] NVARCHAR(500) NULL,
    [agency] NVARCHAR(50) NULL,
    [countryOfOrigin] NVARCHAR(50) NULL,
    [rawJson] NVARCHAR(MAX) NULL,
    [createat] DATETIME NOT NULL CONSTRAINT [DF_parts_createat] DEFAULT (GETDATE()),
    [createby] NVARCHAR(40) NOT NULL CONSTRAINT [DF_parts_createby] DEFAULT ('system'),
    [updateat] DATETIME NOT NULL CONSTRAINT [DF_parts_updateat] DEFAULT (GETDATE()),
    [updateby] NVARCHAR(40) NOT NULL CONSTRAINT [DF_parts_updateby] DEFAULT ('system')
)
GO

CREATE NONCLUSTERED INDEX [IX_parts_vendor_part]
    ON dbo.parts([vendorId] ASC, [partNumber] ASC)
GO

CREATE VIEW dbo.vwParts AS
SELECT
    p.partId,
    p.vendorId,
    v.name AS vendorName,
    p.sourceVendorName,
    p.brand,
    p.parentCategory,
    p.category,
    p.partNumber,
    p.description,
    p.msrp,
    p.cost,
    p.minQty,
    p.upc,
    p.productStatus,
    p.agency,
    p.countryOfOrigin
FROM dbo.parts p
INNER JOIN dbo.vendors v ON p.vendorId = v.vendorId
GO
