CREATE VIEW [dbo].[vwMaterials]
AS
SELECT dbo.materials.*, dbo.categories.name AS categoryName, dbo.vendors.name AS vendorName
FROM     dbo.materials INNER JOIN
                  dbo.categories ON dbo.materials.categoryId = dbo.categories.categoryId INNER JOIN
                  dbo.vendors ON dbo.materials.vendorId = dbo.vendors.vendorId
GO

