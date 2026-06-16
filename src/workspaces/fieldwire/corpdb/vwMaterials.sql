CREATE VIEW [dbo].[vwMaterials]
AS
SELECT dbo.materials.*, dbo.vendors.name AS vendorName
FROM     dbo.materials INNER JOIN
                  dbo.vendors ON dbo.materials.vendorId = dbo.vendors.vendorId
GO
